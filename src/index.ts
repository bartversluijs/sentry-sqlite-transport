import * as Sentry from '@sentry/node';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// Add @types
import './@types/index';

export default class SQLiteCachedTransport extends Sentry.Transports.HTTPSTransport {
  // Database path
  static path = '/tmp/sentry.db';

  // Create SQLite database, so we can save the errors offline
  static async createDatabase(): Promise<Database> {
    // Open database
    const db = await open({
      filename: path.join(SQLiteCachedTransport.path),
      driver: sqlite3.Database,
    });

    // Create events table
    await db.exec('CREATE TABLE IF NOT EXISTS `events` (event_id VARCHAR PRIMARY KEY NOT NULL, event_data TEXT NOT NULL)');

    return db;
  }

  // Send cached events to Sentry
  static async sendCachedEvents(): Promise<void> {
    // Get events from database
    const db = await SQLiteCachedTransport.createDatabase();
    const events = await db.all('SELECT * FROM events LIMIT 100');
    if (events.length === 0) {
      return;
    }

    // Events found, so try to send them
    events.map((event) => {
      // Parse JSON
      event.event_data = JSON.parse(event.event_data);

      // Add cached to event, so we know it's from here
      event.event_data.cached = true;
      return event;
    }).forEach((event) => {
      Sentry.getCurrentHub().getClient()?.captureEvent(event.event_data);
    });
  }

  // Send events in a cached way
  async sendEvent(event: Sentry.Event): Promise<Sentry.Response> {
    // log.info('[sendEvent]', event.event_id, 'Sending event', `(cached: ${(event.cached === true)})`);

    // Try to send the event via the normal way
    let response: Sentry.Response = {
      status: Sentry.Status.Unknown
    };
    try {
      response = await super.sendEvent(event);
    } catch (e) {
      response.status = Sentry.Status.Failed;
    }

    // Save to SQLite database if response is still null
    // And if event was not a cached event
    if (response.status === Sentry.Status.Failed && event.cached !== true) {
      const db = await SQLiteCachedTransport.createDatabase();
      await db.all('INSERT INTO events (event_id, event_data) VALUES (?, ?)', [event.event_id, JSON.stringify(event)]);
    }

    // Remove from SQLite database if response was a success and event was cached
    if (response.status === Sentry.Status.Success && response.status === 'success' && event.cached === true) {
      const db = await SQLiteCachedTransport.createDatabase();
      await db.all('DELETE FROM events WHERE event_id = ?', [event.event_id]);
    }

    return response;
  }
}
