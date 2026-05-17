import { Env } from "../config/env.config";
import UserModel from "../models/user.model";

export const bootstrapDemoUser = async () => {
  if (!Env.SEED_DEMO_USER) {
    return;
  }

  const existingUser = await UserModel.findOne({
    email: Env.DEMO_USER_EMAIL,
  }).lean();

  if (existingUser?._id) {
    return;
  }

  await UserModel.create({
    name: Env.DEMO_USER_NAME,
    email: Env.DEMO_USER_EMAIL,
    password: Env.DEMO_USER_PASSWORD,
  });

  console.log(`Bootstrap demo user created: ${Env.DEMO_USER_EMAIL}`);
};
