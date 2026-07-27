/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const notFound = (req: Request, res: Response, next: NextFunction) => {
  res.status(StatusCodes.NOT_FOUND).type('text/plain').send(String.raw`
404 - Page not found



 /\_/\\
( o.o )  Where am I?
 > ^ <
  


 
`);
};

export default notFound;
