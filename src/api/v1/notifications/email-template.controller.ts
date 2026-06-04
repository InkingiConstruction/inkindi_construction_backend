import { Request, Response } from "express";
import prisma from "../../../lib/prisma.js";

const getId = (id: string | string[] | undefined) =>
  Array.isArray(id) ? id[0] : id;

export const createEmailTemplate = async (req: Request, res: Response) => {
  try {
    const { name, subject, htmlContent, plainText } = req.body;

    if (!name || !subject || !htmlContent) {
      return res.status(400).json({
        message: "name, subject and htmlContent are required",
      });
    }

    const emailTemplate = await prisma.emailTemplate.create({
      data: { name, subject, htmlContent, plainText },
    });

    return res.status(201).json({
      message: "Email template created successfully",
      emailTemplate,
    });
  } catch (error) {
    console.error("Create email template error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEmailTemplates = async (_req: Request, res: Response) => {
  try {
    const emailTemplates = await prisma.emailTemplate.findMany({
      orderBy: { name: "asc" },
    });

    return res.json(emailTemplates);
  } catch (error) {
    console.error("Get email templates error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEmailTemplateById = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Email template ID is required" });
    }

    const emailTemplate = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!emailTemplate) {
      return res.status(404).json({ message: "Email template not found" });
    }

    return res.json(emailTemplate);
  } catch (error) {
    console.error("Get email template by ID error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateEmailTemplate = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);
    const { name, subject, htmlContent, plainText } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Email template ID is required" });
    }

    const emailTemplate = await prisma.emailTemplate.update({
      where: { id },
      data: { name, subject, htmlContent, plainText },
    });

    return res.json({
      message: "Email template updated successfully",
      emailTemplate,
    });
  } catch (error) {
    console.error("Update email template error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteEmailTemplate = async (req: Request, res: Response) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Email template ID is required" });
    }

    await prisma.emailTemplate.delete({ where: { id } });

    return res.json({ message: "Email template deleted successfully" });
  } catch (error) {
    console.error("Delete email template error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
