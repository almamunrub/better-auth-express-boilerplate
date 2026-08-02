/* eslint-disable @typescript-eslint/no-explicit-any */
import { StatusCodes } from 'http-status-codes';
import { auth } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { ICreateAdminPayload, IUpdateProfilePayload } from './user.interface';
import ApiError from '../../errors/ApiError';
import { deleteSingleFile } from '../../utils/deleteFile';
import { Role } from '../../../generated/enums';
import { IRequestUser } from '../../interface/requestUser.interface';
import { envVars } from '../../config/env';
import { Prisma } from '../../../generated/client';

const createAdmin = async (payload: ICreateAdminPayload) => {
  //TODO: Validate who is creating the admin user. Only super admin can create admin user and only super admin can create super admin user but admin user cannot create super admin user

  const userExists = await prisma.user.findUnique({
    where: {
      email: payload.admin.email,
    },
  });

  if (userExists) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'User with this email already exists'
    );
  }

  const { admin, role, password } = payload;

  const userData = await auth.api.signUpEmail({
    body: {
      ...admin,
      password,
      role,
      needPasswordChange: true,
    },
  });

  try {
    const adminData = await prisma.admin.create({
      data: {
        userId: userData.user.id,
        ...admin,
      },
    });

    return adminData;
  } catch (error: any) {
    console.log('Error creating admin: ', error);
    await prisma.user.delete({
      where: {
        id: userData.user.id,
      },
    });
    throw error;
  }
};

const updateProfile = async (
  user: IRequestUser,
  payload: IUpdateProfilePayload,
  file?: Express.Multer.File
) => {
  const imagePath = file
    ? `${envVars.BACKEND_URL}/uploads/${file.filename}`
    : undefined;

  try {
    const result = await prisma.$transaction(async tx => {
      // Update common user information
      const userUpdateData: Prisma.UserUpdateInput = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
      };

      if (imagePath) {
        userUpdateData.image = imagePath;
      }

      await tx.user.update({
        where: {
          id: user.userId,
        },
        data: userUpdateData,
      });

      switch (user.role) {
        case Role.USER: {
          const player = await tx.player.findUnique({
            where: {
              userId: user.userId,
            },
          });

          if (!player) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Player not found');
          }

          await tx.player.update({
            where: {
              userId: user.userId,
            },
            data: {
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              ...(imagePath && {
                profilePhoto: imagePath,
              }),
            },
          });

          return {
            profile: await tx.player.findUnique({
              where: {
                userId: user.userId,
              },
              include: {
                user: true,
              },
            }),
            oldImage: player.profilePhoto,
          };
        }

        case Role.ADMIN:
        case Role.SUPER_ADMIN: {
          const admin = await tx.admin.findUnique({
            where: {
              userId: user.userId,
            },
          });

          if (!admin) {
            throw new ApiError(StatusCodes.NOT_FOUND, 'Admin not found');
          }

          await tx.admin.update({
            where: {
              userId: user.userId,
            },
            data: {
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
              ...(imagePath && {
                profilePhoto: imagePath,
              }),
            },
          });

          return {
            profile: await tx.admin.findUnique({
              where: {
                userId: user.userId,
              },
              include: {
                user: true,
              },
            }),
            oldImage: admin.profilePhoto,
          };
        }

        default:
          throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid user role');
      }
    });

    if (imagePath && result.oldImage) {
      await deleteSingleFile(result.oldImage);
    }

    return result.profile;
  } catch (error) {
    if (imagePath) {
      await deleteSingleFile(imagePath);
    }

    throw error;
  }
};

export const UserService = {
  createAdmin,
  updateProfile,
};
