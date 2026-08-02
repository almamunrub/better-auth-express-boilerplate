import { Router } from 'express';
import { UserController } from './user.controller';
import { checkAuth } from '../../middlewares/auth';
import { Role } from '../../../generated/enums';
import { multerUpload } from '../../config/multer.config';

const router = Router();

router.post(
  '/create-admin',
  checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
  UserController.createAdmin
);

router.patch(
  '/profile',
  checkAuth(Role.USER, Role.ADMIN, Role.SUPER_ADMIN),
  multerUpload.single('profilePhoto'),
  UserController.updateProfile
);

export const UserRoutes = router;
