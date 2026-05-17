import mongoose, { ClientSession } from "mongoose";

export const runWithOptionalTransaction = async <T>(
  callback: (session: ClientSession | null) => Promise<T>
): Promise<T> => {
  try {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch {
    return callback(null);
  }
};
