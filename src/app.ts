/* eslint-disable @typescript-eslint/no-unused-vars */
import express, { Application, NextFunction, Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './app/lib/auth';
import cors from 'cors';
import os from 'os';
import { StatusCodes } from 'http-status-codes';
import router from './app/routes';
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { LogsRoutes } from './app/modules/logger/logs.routes';
import { uploadDir } from './app/config/upload.config';
import cookieParser from 'cookie-parser';
import path from 'path';
import qs from 'qs';
import { envVars } from './app/config/env';

const app: Application = express();
app.set('query parser', (str: string) => qs.parse(str));

app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), `src/app/templates`));

app.use(
  cors({
    origin: [
      envVars.FRONTEND_URL,
      envVars.BETTER_AUTH_URL,
      'http://localhost:3000',
      'http://localhost:5000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-client-type',
      'Accept',
      'Origin',
    ],
  })
);

app.use('/api/auth', toNodeHandler(auth));

// Middleware to parse JSON bodies
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve the uploads directory statically
app.use('/uploads', express.static(uploadDir));

app.use('/api/v1', router);

// Test route
app.get('/', (req: Request, res: Response, next: NextFunction) => {
  const currentDateTime = new Date().toISOString();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const serverHostname = os.hostname();
  const serverPlatform = os.platform();
  const serverUptime = os.uptime();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Welcome to the API',
    version: '1.0.0',
    clientDetails: {
      ipAddress: clientIp,
      accessedAt: currentDateTime,
    },
    serverDetails: {
      hostname: serverHostname,
      platform: serverPlatform,
      uptime: `${Math.floor(serverUptime / 60 / 60)} hours ${Math.floor(
        (serverUptime / 60) % 60
      )} minutes`,
    },
  });
});

//Logger Routes
app.use('/logs', LogsRoutes);

app.use(globalErrorHandler);

//Not Found
app.use(notFound);

export default app;
