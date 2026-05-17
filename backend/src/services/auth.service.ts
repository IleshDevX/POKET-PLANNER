import UserModel from "../models/user.model";
import { NotFoundException, UnauthorizedException } from "../utils/app-error";
import {
  LoginSchemaType,
  RegisterSchemaType,
} from "../validators/auth.validator";
import ReportSettingModel, {
  ReportFrequencyEnum,
} from "../models/report-setting.model";
import { calulateNextReportDate } from "../utils/helper";
import { signJwtToken } from "../utils/jwt";
import { runWithOptionalTransaction } from "../utils/transaction";

export const registerService = async (body: RegisterSchemaType) => {
  const { email } = body;

  return runWithOptionalTransaction(async (session) => {
    const existingUserQuery = UserModel.findOne({ email });
    const existingUser = session
      ? await existingUserQuery.session(session)
      : await existingUserQuery;

    if (existingUser) {
      throw new UnauthorizedException("User already exists");
    }

    const newUser = new UserModel({
      ...body,
    });

    await newUser.save(session ? { session } : undefined);

    const reportSetting = new ReportSettingModel({
      userId: newUser._id,
      frequency: ReportFrequencyEnum.MONTHLY,
      isEnabled: true,
      nextReportDate: calulateNextReportDate(),
      lastSentDate: null,
    });
    await reportSetting.save(session ? { session } : undefined);

    return { user: newUser.omitPassword() };
  });
};

export const loginService = async (body: LoginSchemaType) => {
  const { email, password } = body;
  const user = await UserModel.findOne({ email });
  if (!user) throw new NotFoundException("Email/password not found");

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid)
    throw new UnauthorizedException("Invalid email/password");

  const { token, expiresAt } = signJwtToken({ userId: user.id });

  const reportSetting = await ReportSettingModel.findOne(
    {
      userId: user.id,
    },
    { _id: 1, frequency: 1, isEnabled: 1 }
  ).lean();

  return {
    user: user.omitPassword(),
    accessToken: token,
    expiresAt,
    reportSetting,
  };
};
