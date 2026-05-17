import "dotenv/config";
import mongoose from "mongoose";
import { Env } from "../config/env.config";
import UserModel from "../models/user.model";
import TransactionModel, {
  PaymentMethodEnum,
  TransactionTypeEnum,
} from "../models/transaction.model";
import ReportSettingModel, {
  ReportFrequencyEnum,
} from "../models/report-setting.model";

type SeedTx = {
  title: string;
  type: keyof typeof TransactionTypeEnum;
  amount: number;
  category: string;
  paymentMethod: keyof typeof PaymentMethodEnum;
  daysAgo?: number;
  date?: Date;
  description?: string;
};

type SeedUser = {
  name: string;
  email: string;
  password: string;
  transactions: SeedTx[];
};

type YearlyProfile = {
  salary: number;
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  dining: number;
  shopping: number;
  bonus?: number;
};

/** Build a Date for a specific absolute month offset from today */
const buildMonthlyDate = (totalMonthsAgo: number, day: number) => {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - totalMonthsAgo, day);
  return target;
};

/** Generate transactions for a single calendar month */
const buildMonthTransactions = (
  profile: YearlyProfile,
  totalMonthsAgo: number,
  monthIndex: number // 0-based index within the full 3-year run (0 = oldest)
): SeedTx[] => {
  const transactions: SeedTx[] = [];

  const salaryAmount    = profile.salary    + monthIndex * 150;
  const groceriesAmount = profile.groceries + (monthIndex % 3) * 200;
  const utilitiesAmount = profile.utilities + (monthIndex % 2) * 120;
  const transportAmount = profile.transport + (monthIndex % 4) * 100;
  const diningAmount    = profile.dining    + (monthIndex % 5) * 80;
  const shoppingAmount  = profile.shopping  + (monthIndex % 6) * 150;

  // Income
  transactions.push({
    title: "Salary Credit",
    type: TransactionTypeEnum.INCOME,
    amount: salaryAmount,
    category: "salary",
    paymentMethod: PaymentMethodEnum.BANK_TRANSFER,
    date: buildMonthlyDate(totalMonthsAgo, 1),
    description: "Monthly salary",
  });

  // Expenses
  transactions.push(
    {
      title: "House Rent",
      type: TransactionTypeEnum.EXPENSE,
      amount: profile.rent,
      category: "housing",
      paymentMethod: PaymentMethodEnum.AUTO_DEBIT,
      date: buildMonthlyDate(totalMonthsAgo, 4),
    },
    {
      title: "Grocery Shopping",
      type: TransactionTypeEnum.EXPENSE,
      amount: groceriesAmount,
      category: "groceries",
      paymentMethod: PaymentMethodEnum.CARD,
      date: buildMonthlyDate(totalMonthsAgo, 7),
    },
    {
      title: "Electricity & Water Bill",
      type: TransactionTypeEnum.EXPENSE,
      amount: utilitiesAmount,
      category: "utilities",
      paymentMethod: PaymentMethodEnum.AUTO_DEBIT,
      date: buildMonthlyDate(totalMonthsAgo, 11),
    },
    {
      title: "Fuel & Commute",
      type: TransactionTypeEnum.EXPENSE,
      amount: transportAmount,
      category: "transportation",
      paymentMethod: PaymentMethodEnum.CARD,
      date: buildMonthlyDate(totalMonthsAgo, 15),
    },
    {
      title: "Dining Out",
      type: TransactionTypeEnum.EXPENSE,
      amount: diningAmount,
      category: "food",
      paymentMethod: PaymentMethodEnum.CARD,
      date: buildMonthlyDate(totalMonthsAgo, 19),
    },
    {
      title: "Shopping",
      type: TransactionTypeEnum.EXPENSE,
      amount: shoppingAmount,
      category: "shopping",
      paymentMethod: PaymentMethodEnum.CARD,
      date: buildMonthlyDate(totalMonthsAgo, 23),
    }
  );

  // Quarterly bonus / freelance
  if (profile.bonus && monthIndex % 3 === 0) {
    transactions.push({
      title: "Freelance Bonus",
      type: TransactionTypeEnum.INCOME,
      amount: profile.bonus,
      category: "freelance",
      paymentMethod: PaymentMethodEnum.BANK_TRANSFER,
      date: buildMonthlyDate(totalMonthsAgo, 27),
    });
  }

  // Occasional one-offs
  if (monthIndex % 12 === 0) {
    transactions.push({
      title: "Annual Insurance Premium",
      type: TransactionTypeEnum.EXPENSE,
      amount: 12000,
      category: "insurance",
      paymentMethod: PaymentMethodEnum.BANK_TRANSFER,
      date: buildMonthlyDate(totalMonthsAgo, 10),
      description: "Yearly life & health insurance",
    });
  }
  if (monthIndex % 6 === 2) {
    transactions.push({
      title: "Medical Checkup",
      type: TransactionTypeEnum.EXPENSE,
      amount: 3500,
      category: "health",
      paymentMethod: PaymentMethodEnum.CARD,
      date: buildMonthlyDate(totalMonthsAgo, 14),
    });
  }
  if (monthIndex % 4 === 1) {
    transactions.push({
      title: "OTT Subscriptions",
      type: TransactionTypeEnum.EXPENSE,
      amount: 799,
      category: "entertainment",
      paymentMethod: PaymentMethodEnum.CARD,
      date: buildMonthlyDate(totalMonthsAgo, 5),
    });
  }

  return transactions;
};

/** Build 3 years (36 months) of transactions */
const build3YearTransactions = (profile: YearlyProfile): SeedTx[] => {
  const MONTHS = 36;
  const all: SeedTx[] = [];

  for (let i = 0; i < MONTHS; i++) {
    const totalMonthsAgo = MONTHS - 1 - i; // oldest first
    all.push(...buildMonthTransactions(profile, totalMonthsAgo, i));
  }

  return all;
};

/** Original 1-year helper kept for the demo account */
const buildMonthlyDateLegacy = (monthsAgo: number, day: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
};

const buildYearlyTransactions = (profile: YearlyProfile): SeedTx[] => {
  const transactions: SeedTx[] = [];

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo -= 1) {
    const monthIndex = 11 - monthsAgo;
    const salaryAmount    = profile.salary    + monthIndex * 250;
    const groceriesAmount = profile.groceries + (monthIndex % 3) * 250;
    const utilitiesAmount = profile.utilities + (monthIndex % 2) * 150;
    const transportAmount = profile.transport + (monthIndex % 4) * 120;
    const diningAmount    = profile.dining    + (monthIndex % 5) * 100;
    const shoppingAmount  = profile.shopping  + (monthIndex % 6) * 180;

    transactions.push(
      { title: "Salary Credit",    type: TransactionTypeEnum.INCOME,  amount: salaryAmount,    category: "salary",         paymentMethod: PaymentMethodEnum.BANK_TRANSFER, date: buildMonthlyDateLegacy(monthsAgo, 1),  description: "Monthly salary" },
      { title: "House Rent",       type: TransactionTypeEnum.EXPENSE, amount: profile.rent,    category: "housing",        paymentMethod: PaymentMethodEnum.AUTO_DEBIT,   date: buildMonthlyDateLegacy(monthsAgo, 4)  },
      { title: "Grocery Shopping", type: TransactionTypeEnum.EXPENSE, amount: groceriesAmount, category: "groceries",      paymentMethod: PaymentMethodEnum.CARD,         date: buildMonthlyDateLegacy(monthsAgo, 7)  },
      { title: "Electricity Bill", type: TransactionTypeEnum.EXPENSE, amount: utilitiesAmount, category: "utilities",      paymentMethod: PaymentMethodEnum.AUTO_DEBIT,   date: buildMonthlyDateLegacy(monthsAgo, 11) },
      { title: "Fuel & Commute",   type: TransactionTypeEnum.EXPENSE, amount: transportAmount, category: "transportation", paymentMethod: PaymentMethodEnum.CARD,         date: buildMonthlyDateLegacy(monthsAgo, 15) },
      { title: "Dining Out",       type: TransactionTypeEnum.EXPENSE, amount: diningAmount,    category: "food",           paymentMethod: PaymentMethodEnum.CARD,         date: buildMonthlyDateLegacy(monthsAgo, 19) },
      { title: "Shopping",         type: TransactionTypeEnum.EXPENSE, amount: shoppingAmount,  category: "shopping",       paymentMethod: PaymentMethodEnum.CARD,         date: buildMonthlyDateLegacy(monthsAgo, 23) }
    );

    if (profile.bonus && monthIndex % 3 === 0) {
      transactions.push({ title: "Freelance Bonus", type: TransactionTypeEnum.INCOME, amount: profile.bonus, category: "freelance", paymentMethod: PaymentMethodEnum.BANK_TRANSFER, date: buildMonthlyDateLegacy(monthsAgo, 27) });
    }
  }

  return transactions;
};

const seedUsers: SeedUser[] = [
  {
    name: "Pocket Planner Demo",
    email: "poketplanner@gmail.com",
    password: "Pocket@12345",
    transactions: buildYearlyTransactions({
      salary: 90000, rent: 24000, groceries: 5200,
      utilities: 2800, transport: 3200, dining: 2400, shopping: 4500, bonus: 15000,
    }),
  },
  {
    name: "Aakash Patel",
    email: "aakash.patel@pocketplanner.local",
    password: "Aakash@12345",
    // Full 3-year data with both income and expenses
    transactions: build3YearTransactions({
      salary: 77000, rent: 21000, groceries: 4300,
      utilities: 2600, transport: 3800, dining: 2600, shopping: 5200, bonus: 8000,
    }),
  },
];

const minusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const resolveTransactionDate = (tx: SeedTx) => {
  if (tx.date) return tx.date;
  if (tx.daysAgo !== undefined) return minusDays(tx.daysAgo);
  return new Date();
};

const redactMongoUri = (uri: string) =>
  uri.replace(/\/\/([^:/?#]+):([^@]+)@/, "//$1:****@");

const getMongoConnectionUris = () => {
  const primaryUri = Env.MONGO_URI.trim();
  const uris = [primaryUri];

  if (Env.DB_FALLBACK_ENABLED) {
    const fallbackUri = Env.MONGO_FALLBACK_URI.trim();
    if (fallbackUri && fallbackUri !== primaryUri) {
      uris.push(fallbackUri);
    }
  }

  return uris;
};

const connectToDatabase = async () => {
  let lastError: unknown = null;

  for (const uri of getMongoConnectionUris()) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
      });
      console.log(`Connected to MongoDB database (${redactMongoUri(uri)})`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Failed MongoDB connection attempt (${redactMongoUri(uri)})`);
      await mongoose.disconnect().catch(() => undefined);
    }
  }

  throw lastError;
};

const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const upsertSeedUser = async (seedUser: SeedUser) => {
  const existingUser = await UserModel.findOne({ email: seedUser.email });

  if (existingUser) {
    existingUser.name = seedUser.name;
    existingUser.password = seedUser.password;
    await existingUser.save();
    return existingUser;
  }

  return UserModel.create({
    name: seedUser.name,
    email: seedUser.email,
    password: seedUser.password,
  });
};

const seedDemoData = async () => {
  await connectToDatabase();

  try {
    let totalTransactions = 0;

    const seededUsers = [] as Array<{ seedUser: SeedUser; user: Awaited<ReturnType<typeof upsertSeedUser>> }>;

    for (const seedUser of seedUsers) {
      const user = await upsertSeedUser(seedUser);
      seededUsers.push({ seedUser, user });
    }

    const keepUserIds = seededUsers.map(({ user }) => user._id);

    await Promise.all([
      UserModel.deleteMany({ _id: { $nin: keepUserIds } }),
      TransactionModel.deleteMany({ userId: { $nin: keepUserIds } }),
      ReportSettingModel.deleteMany({ userId: { $nin: keepUserIds } }),
    ]);

    for (const { seedUser, user } of seededUsers) {
      await Promise.all([
        TransactionModel.deleteMany({ userId: user._id }),
        ReportSettingModel.deleteMany({ userId: user._id }),
      ]);

      await ReportSettingModel.create({
        userId: user._id,
        frequency: ReportFrequencyEnum.MONTHLY,
        isEnabled: true,
        nextReportDate: plusDays(7),
        lastSentDate: null,
      });

      const docs = seedUser.transactions.map((tx) => {
        const transactionDate = resolveTransactionDate(tx);
        return {
          userId: user._id,
          title: tx.title,
          type: tx.type,
          amount: tx.amount,
          category: tx.category,
          paymentMethod: tx.paymentMethod,
          date: transactionDate,
          description: tx.description,
          isRecurring: false,
          recurringInterval: null,
          nextRecurringDate: null,
          lastProcessed: null,
          createdAt: transactionDate,
          updatedAt: transactionDate,
        };
      });

      await TransactionModel.create(docs);
      totalTransactions += docs.length;

      console.log(`Seeded ${seedUser.name} (${seedUser.email}) with ${docs.length} transactions`);
    }

    console.log("Seed completed successfully");
    console.log(`Users created or updated: ${seedUsers.length}`);
    console.log(`Transactions created: ${totalTransactions}`);
  } finally {
    await mongoose.disconnect();
  }
};

seedDemoData().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
