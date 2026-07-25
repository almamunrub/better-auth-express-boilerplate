/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
import { envVars } from '../config/env';
import { prisma } from '../lib/prisma';
import { CookieUtils } from '../utils/cookie';
import { jwtUtils } from '../utils/jwt';
import ApiError from '../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { Role, UserStatus } from '../../generated/enums';

export const checkAuth =
  (...authRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      //Session Token Verification
      const sessionToken =
        CookieUtils.getCookie(req, 'better-auth.session_token') ||
        CookieUtils.getCookie(req, '__Secure-better-auth.session_token') ||
        CookieUtils.getCookie(req, 'session_token') ||
        CookieUtils.getCookie(req, '__Secure-session_token');
      // console.log(sessionToken, 'session token');

      if (!sessionToken) {
        throw new Error('Unauthorized access! No session token provided.');
      }

      if (sessionToken) {
        const sessionExists = await prisma.session.findFirst({
          where: {
            token: sessionToken,
            expiresAt: {
              gt: new Date(),
            },
          },
          include: {
            user: true,
          },
        });

        if (sessionExists && sessionExists.user) {
          const user = sessionExists.user;

          const now = new Date();
          const expiresAt = new Date(sessionExists.expiresAt);
          const createdAt = new Date(sessionExists.createdAt);

          const sessionLifeTime = expiresAt.getTime() - createdAt.getTime();
          const timeRemaining = expiresAt.getTime() - now.getTime();
          const percentRemaining = (timeRemaining / sessionLifeTime) * 100;

          if (percentRemaining < 20) {
            res.setHeader('X-Session-Refresh', 'true');
            res.setHeader('X-Session-Expires-At', expiresAt.toISOString());
            res.setHeader('X-Time-Remaining', timeRemaining.toString());

            console.log('Session Expiring Soon!!');
          }

          if (
            user.status === UserStatus.BLOCKED ||
            user.status === UserStatus.DELETED
          ) {
            throw new ApiError(
              StatusCodes.UNAUTHORIZED,
              'Unauthorized access! User is not active.'
            );
          }

          if (user.isDeleted) {
            throw new ApiError(
              StatusCodes.UNAUTHORIZED,
              'Unauthorized access! User is deleted.'
            );
          }

          if (authRoles.length > 0 && !authRoles.includes(user.role)) {
            throw new ApiError(
              StatusCodes.FORBIDDEN,
              'Forbidden access! You do not have permission to access this resource.'
            );
          }

          req.user = {
            userId: user.id,
            role: user.role,
            email: user.email,
          };
        }

        const accessToken = CookieUtils.getCookie(req, 'accessToken');

        if (!accessToken) {
          throw new ApiError(
            StatusCodes.UNAUTHORIZED,
            'Unauthorized access! No access token provided.'
          );
        }
      }

      //Access Token Verification
      const accessToken = CookieUtils.getCookie(req, 'accessToken');

      if (!accessToken) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Unauthorized access! No access token provided.'
        );
      }

      const verifiedToken = jwtUtils.verifyToken(
        accessToken,
        envVars.ACCESS_TOKEN_SECRET
      );

      if (!verifiedToken.success) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Unauthorized access! Invalid access token.'
        );
      }

      if (
        authRoles.length > 0 &&
        !authRoles.includes(verifiedToken.data!.role as Role)
      ) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'Forbidden access! You do not have permission to access this resource.'
        );
      }

      if (!req.user) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          'Unauthorized access! Invalid or expired session.'
        );
      }

      next();
    } catch (error: any) {
      next(error);
    }
  };
