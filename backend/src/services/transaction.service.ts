import axios from "axios";
import TransactionModel, {
  TransactionTypeEnum,
} from "../models/transaction.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { calculateNextOccurrence } from "../utils/helper";
import {
  CreateTransactionType,
  UpdateTransactionType,
} from "../validators/transaction.validator";
import { genAI, genAIModel } from "../config/google-ai.config";
import { createPartFromBase64, createUserContent } from "@google/genai";
import { receiptPrompt } from "../utils/prompt";
import { Env } from "../config/env.config";

export const createTransactionService = async (
  body: CreateTransactionType,
  userId: string
) => {
  let nextRecurringDate: Date | undefined;
  const currentDate = new Date();

  if (body.isRecurring && body.recurringInterval) {
    const calulatedDate = calculateNextOccurrence(
      body.date,
      body.recurringInterval
    );

    nextRecurringDate =
      calulatedDate < currentDate
        ? calculateNextOccurrence(currentDate, body.recurringInterval)
        : calulatedDate;
  }

  const transaction = await TransactionModel.create({
    ...body,
    userId,
    category: body.category,
    amount: Number(body.amount),
    isRecurring: body.isRecurring || false,
    recurringInterval: body.recurringInterval || null,
    nextRecurringDate,
    lastProcessed: null,
  });

  return transaction;
};

export const getAllTransactionService = async (
  userId: string,
  filters: {
    keyword?: string;
    type?: keyof typeof TransactionTypeEnum;
    recurringStatus?: "RECURRING" | "NON_RECURRING";
  },
  pagination: {
    pageSize: number;
    pageNumber: number;
  }
) => {
  const { keyword, type, recurringStatus } = filters;

  const filterConditions: Record<string, any> = {
    userId,
  };

  if (keyword) {
    filterConditions.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { category: { $regex: keyword, $options: "i" } },
    ];
  }

  if (type) {
    filterConditions.type = type;
  }

  if (recurringStatus) {
    if (recurringStatus === "RECURRING") {
      filterConditions.isRecurring = true;
    } else if (recurringStatus === "NON_RECURRING") {
      filterConditions.isRecurring = false;
    }
  }

  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;

  const [transations, totalCount] = await Promise.all([
    TransactionModel.find(filterConditions)
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 }),
    TransactionModel.countDocuments(filterConditions),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    transations,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip,
    },
  };
};

export const getTransactionByIdService = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await TransactionModel.findOne({
    _id: transactionId,
    userId,
  });
  if (!transaction) throw new NotFoundException("Transaction not found");

  return transaction;
};

export const duplicateTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const transaction = await TransactionModel.findOne({
    _id: transactionId,
    userId,
  });
  if (!transaction) throw new NotFoundException("Transaction not found");

  const duplicated = await TransactionModel.create({
    ...transaction.toObject(),
    _id: undefined,
    title: `Duplicate - ${transaction.title}`,
    description: transaction.description
      ? `${transaction.description} (Duplicate)`
      : "Duplicated transaction",
    isRecurring: false,
    recurringInterval: undefined,
    nextRecurringDate: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  });

  return duplicated;
};

export const updateTransactionService = async (
  userId: string,
  transactionId: string,
  body: UpdateTransactionType
) => {
  const existingTransaction = await TransactionModel.findOne({
    _id: transactionId,
    userId,
  });
  if (!existingTransaction)
    throw new NotFoundException("Transaction not found");

  const now = new Date();
  const isRecurring = body.isRecurring ?? existingTransaction.isRecurring;

  const date =
    body.date !== undefined ? new Date(body.date) : existingTransaction.date;

  const recurringInterval =
    body.recurringInterval || existingTransaction.recurringInterval;

  let nextRecurringDate: Date | undefined;

  if (isRecurring && recurringInterval) {
    const calulatedDate = calculateNextOccurrence(date, recurringInterval);

    nextRecurringDate =
      calulatedDate < now
        ? calculateNextOccurrence(now, recurringInterval)
        : calulatedDate;
  }

  existingTransaction.set({
    ...(body.title && { title: body.title }),
    ...(body.description && { description: body.description }),
    ...(body.category && { category: body.category }),
    ...(body.type && { type: body.type }),
    ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
    ...(body.amount !== undefined && { amount: Number(body.amount) }),
    date,
    isRecurring,
    recurringInterval,
    nextRecurringDate,
  });

  await existingTransaction.save();

  return;
};

export const deleteTransactionService = async (
  userId: string,
  transactionId: string
) => {
  const deleted = await TransactionModel.findByIdAndDelete({
    _id: transactionId,
    userId,
  });
  if (!deleted) throw new NotFoundException("Transaction not found");

  return;
};

export const bulkDeleteTransactionService = async (
  userId: string,
  transactionIds: string[]
) => {
  const result = await TransactionModel.deleteMany({
    _id: { $in: transactionIds },
    userId,
  });

  if (result.deletedCount === 0)
    throw new NotFoundException("No transations found");

  return {
    sucess: true,
    deletedCount: result.deletedCount,
  };
};

export const bulkTransactionService = async (
  userId: string,
  transactions: CreateTransactionType[]
) => {
  try {
    const bulkOps = transactions.map((tx) => ({
      insertOne: {
        document: {
          ...tx,
          userId,
          isRecurring: false,
          nextRecurringDate: null,
          recurringInterval: null,
          lastProcesses: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    }));

    const result = await TransactionModel.bulkWrite(bulkOps, {
      ordered: true,
    });

    return {
      insertedCount: result.insertedCount,
      success: true,
    };
  } catch (error) {
    throw error;
  }
};

type ProviderName = "Gemini" | "Groq" | "OpenAI";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const stripJsonMarkdown = (value: string) =>
  value.replace(/```(?:json)?\n?/gi, "").replace(/```/g, "").trim();

const extractMessageContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
};

const parseReceiptPayload = (responseText: string) => {
  const cleanedText = stripJsonMarkdown(responseText || "");

  if (!cleanedText) {
    throw new Error("Could not read receipt content");
  }

  const jsonCandidates = [cleanedText];
  const objectMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0] && objectMatch[0] !== cleanedText) {
    jsonCandidates.push(objectMatch[0]);
  }

  let data: any;
  let parsed = false;

  for (const candidate of jsonCandidates) {
    try {
      data = JSON.parse(candidate);
      parsed = true;
      break;
    } catch {
      try {
        data = JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
        parsed = true;
        break;
      } catch {
        // Continue trying next candidate.
      }
    }
  }

  if (!parsed) {
    throw new Error("Could not parse scanned receipt data");
  }

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !data.date) {
    throw new Error("Receipt missing required information");
  }

  const normalizedType =
    String(data.type || TransactionTypeEnum.EXPENSE).toUpperCase() ===
    TransactionTypeEnum.INCOME
      ? TransactionTypeEnum.INCOME
      : TransactionTypeEnum.EXPENSE;

  return {
    title: data.title || "Receipt",
    amount,
    date: data.date,
    description: data.description,
    category: data.category,
    paymentMethod: data.paymentMethod,
    type: normalizedType,
  };
};

const formatProviderError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    const responseData = error.response?.data as any;
    const detailedMessage =
      responseData?.error?.message || responseData?.message || error.message;

    const lowerMessage = String(detailedMessage || "").toLowerCase();

    if (statusCode === 429 || lowerMessage.includes("quota")) {
      return "quota exceeded";
    }

    if (
      statusCode === 401 ||
      statusCode === 403 ||
      lowerMessage.includes("api key") ||
      lowerMessage.includes("unauthorized")
    ) {
      return "invalid API key";
    }

    if (typeof detailedMessage === "string") {
      return detailedMessage.slice(0, 220);
    }

    return error.message;
  }

  if (error instanceof Error) {
    const lowerMessage = error.message.toLowerCase();

    if (lowerMessage.includes("quota") || lowerMessage.includes("429")) {
      return "quota exceeded";
    }

    if (
      lowerMessage.includes("api key") ||
      lowerMessage.includes("unauthorized")
    ) {
      return "invalid API key";
    }

    return error.message.slice(0, 220);
  }

  return "Unknown error";
};

const scanWithGemini = async (base64String: string, mimeType: string) => {
  if (!Env.GEMINI_API_KEY || !genAI) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const result = await genAI.models.generateContent({
    model: genAIModel,
    contents: [
      createUserContent([
        receiptPrompt,
        createPartFromBase64(base64String, mimeType),
      ]),
    ],
    config: {
      temperature: 0,
      topP: 1,
      responseMimeType: "application/json",
    },
  });

  return result.text || "";
};

const scanWithOpenAICompatible = async ({
  apiUrl,
  apiKey,
  model,
  imageDataUrl,
}: {
  apiUrl: string;
  apiKey: string;
  model: string;
  imageDataUrl: string;
}) => {
  const response = await axios.post(
    apiUrl,
    {
      model,
      temperature: 0,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: receiptPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 900,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 45000,
    }
  );

  return extractMessageContent(response.data?.choices?.[0]?.message?.content);
};

export const scanReceiptService = async (
  file: Express.Multer.File | undefined
) => {
  if (!file) throw new BadRequestException("No file uploaded");

  if (!file.path) {
    throw new BadRequestException("Failed to upload file");
  }

  console.log(file.path);

  const responseData = await axios.get(file.path, {
    responseType: "arraybuffer",
  });
  const base64String = Buffer.from(responseData.data).toString("base64");

  if (!base64String) {
    throw new BadRequestException("Could not process file");
  }

  const imageDataUrl = `data:${file.mimetype};base64,${base64String}`;

  const providers: Array<{ name: ProviderName; run: () => Promise<string> }> =
    [];

  if (Env.GEMINI_API_KEY) {
    providers.push({
      name: "Gemini",
      run: () => scanWithGemini(base64String, file.mimetype),
    });
  }

  if (Env.GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      run: () =>
        scanWithOpenAICompatible({
          apiUrl: GROQ_CHAT_URL,
          apiKey: Env.GROQ_API_KEY,
          model: Env.GROQ_MODEL,
          imageDataUrl,
        }),
    });
  }

  if (Env.OPENAI_API_KEY) {
    providers.push({
      name: "OpenAI",
      run: () =>
        scanWithOpenAICompatible({
          apiUrl: OPENAI_CHAT_URL,
          apiKey: Env.OPENAI_API_KEY,
          model: Env.OPENAI_MODEL,
          imageDataUrl,
        }),
    });
  }

  if (providers.length === 0) {
    throw new BadRequestException(
      "No AI provider configured. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY"
    );
  }

  const providerErrors: string[] = [];

  for (const provider of providers) {
    try {
      const responseText = await provider.run();
      const parsed = parseReceiptPayload(responseText);

      return {
        ...parsed,
        receiptUrl: file.path,
      };
    } catch (error) {
      providerErrors.push(`${provider.name}: ${formatProviderError(error)}`);
    }
  }

  const fallbackHint =
    providers.length === 1 && providers[0].name === "Gemini"
      ? " Add GROQ_API_KEY or OPENAI_API_KEY for fallback."
      : "";

  throw new BadRequestException(
    `Receipt scan failed across configured providers. ${providerErrors.join(" | ")}.${fallbackHint}`
  );
};
