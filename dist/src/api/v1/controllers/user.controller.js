import prisma from "../../../lib/prisma.js";
export const getEngineers = async (req, res) => {
    try {
        const engineers = await prisma.user.findMany({
            where: {
                role: "engineer",
                banned: false,
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phoneNumber: true,
                username: true,
                displayUsername: true,
                kycStatus: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json(engineers);
    }
    catch (error) {
        console.error("Get engineers error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const createUser = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getUsers = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getUserById = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
export const updateUser = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
export const deleteUser = async (req, res) => {
    try {
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
