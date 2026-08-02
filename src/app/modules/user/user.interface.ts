export interface ICreateAdminPayload {
  password: string;
  admin: {
    name: string;
    email: string;
    profilePhoto?: string;
    contactNumber?: string;
  };
  role: 'ADMIN' | 'SUPER_ADMIN';
}

export interface IUpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
}
