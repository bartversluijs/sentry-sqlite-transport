# Sentry SQLite Transport
This Sentry transport will try and send Sentry events via the standard HTTPSTransport.  
But if this fails, it'll store the event in an SQLite database with the property `cached: true`.  
This transport is created for IoT devices that can lose their internet connection from time to time, but don't want to lose any error logs in the meantime.  
