import prisma from "../lib/prisma.js";
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const canManageProjectMember = (project, userId, role) => {
    if (role === "admin")
        return true;
    if (role === "client")
        return project.clientId === userId;
    if (role === "engineer")
        return project.engineerId === userId;
    return false;
};
export const createProjectMember = async (req, res) => {
    try {
        const { projectId, userId, role = "engineer" } = req.body;
        if (!projectId || !userId) {
            return res
                .status(400)
                .json({ message: "projectId and userId are required" });
        }
        const project = await prisma.project.findUnique({
            where: { id: String(projectId) },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (req.user.role !== "admin" && project.clientId !== req.user.id) {
            return res.status(403).json({
                message: "Only the project owner client can assign an engineer",
                projectClientId: project.clientId,
                currentUserId: req.user.id,
                currentRole: req.user.role,
            });
        }
        const user = await prisma.user.findUnique({
            where: { id: String(userId) },
            select: {
                id: true,
                role: true,
                name: true,
                email: true,
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.role !== role) {
            return res.status(400).json({
                message: `Selected user is not a ${role}`,
            });
        }
        if (role === "engineer" &&
            project.engineerId &&
            project.engineerId !== user.id) {
            return res.status(400).json({
                message: "Project already has an accepted engineer",
            });
        }
        const assignment = await prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: project.id,
                    userId: user.id,
                },
            },
            update: {
                role,
                status: "pending",
                invitedAt: new Date(),
                acceptedAt: null,
                removedAt: null,
            },
            create: {
                projectId: project.id,
                userId: user.id,
                role,
            },
            include: {
                project: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                    },
                },
            },
        });
        return res.status(201).json({
            message: "Project assignment sent",
            assignment,
        });
    }
    catch (error) {
        console.error("Create project member error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getProjectMembers = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const assignments = await prisma.projectMember.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(status ? { status: status } : {}),
                ...(req.user.role === "admin"
                    ? {}
                    : req.user.role === "client"
                        ? { project: { clientId: req.user.id } }
                        : { userId: req.user.id }),
            },
            include: {
                project: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                    },
                },
            },
            orderBy: {
                invitedAt: "desc",
            },
        });
        return res.json(assignments);
    }
    catch (error) {
        console.error("Get project members error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const getProjectMemberById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await prisma.projectMember.findUnique({
            where: { id },
            include: {
                project: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                    },
                },
            },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        const canRead = req.user.role === "admin" ||
            assignment.userId === req.user.id ||
            assignment.project.clientId === req.user.id ||
            assignment.project.engineerId === req.user.id;
        if (!canRead) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(assignment);
    }
    catch (error) {
        console.error("Get project member by ID error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const updateProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { role, status } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const existingAssignment = await prisma.projectMember.findUnique({
            where: { id },
            include: { project: true },
        });
        if (!existingAssignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        if (!canManageProjectMember(existingAssignment.project, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the project owner, assigned engineer, or admin can update this assignment",
            });
        }
        const assignment = await prisma.projectMember.update({
            where: { id },
            data: {
                ...(role ? { role: String(role) } : {}),
                ...(status ? { status: status } : {}),
            },
            include: {
                project: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                    },
                },
            },
        });
        return res.json({
            message: "Assignment updated successfully",
            assignment,
        });
    }
    catch (error) {
        console.error("Update project member error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const acceptProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await prisma.projectMember.findUnique({
            where: { id },
            include: { project: true },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        if (assignment.userId !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({
                message: "Only the invited engineer or admin can accept this assignment",
            });
        }
        if (assignment.status !== "pending") {
            return res.status(400).json({
                message: "Only pending assignments can be accepted",
            });
        }
        const acceptedAssignment = await prisma.$transaction(async (tx) => {
            const updated = await tx.projectMember.update({
                where: { id },
                data: {
                    status: "accepted",
                    acceptedAt: new Date(),
                    removedAt: null,
                },
                include: {
                    project: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            image: true,
                        },
                    },
                },
            });
            if (updated.role === "engineer") {
                await tx.project.update({
                    where: { id: updated.projectId },
                    data: { engineerId: updated.userId },
                });
                await tx.projectMember.updateMany({
                    where: {
                        projectId: updated.projectId,
                        role: "engineer",
                        status: "pending",
                        NOT: { id: updated.id },
                    },
                    data: {
                        status: "declined",
                        removedAt: new Date(),
                    },
                });
            }
            return updated;
        });
        return res.json({
            message: "Project assignment accepted",
            assignment: acceptedAssignment,
        });
    }
    catch (error) {
        console.error("Accept project member error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const rejectProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await prisma.projectMember.findUnique({
            where: { id },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        if (assignment.userId !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({
                message: "Only the invited engineer or admin can reject this assignment",
            });
        }
        if (assignment.status !== "pending") {
            return res.status(400).json({
                message: "Only pending assignments can be rejected",
            });
        }
        const rejectedAssignment = await prisma.projectMember.update({
            where: { id },
            data: {
                status: "declined",
                removedAt: new Date(),
            },
            include: {
                project: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                    },
                },
            },
        });
        return res.json({
            message: "Project assignment rejected",
            assignment: rejectedAssignment,
        });
    }
    catch (error) {
        console.error("Reject project member error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
export const deleteProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await prisma.projectMember.findUnique({
            where: { id },
            include: { project: true },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        if (!canManageProjectMember(assignment.project, req.user.id, req.user.role)) {
            return res.status(403).json({
                message: "Only the project owner, assigned engineer, or admin can remove this assignment",
            });
        }
        const removedAssignment = await prisma.$transaction(async (tx) => {
            const updated = await tx.projectMember.update({
                where: { id },
                data: {
                    status: "removed",
                    removedAt: new Date(),
                },
            });
            if (assignment.role === "engineer" &&
                assignment.project.engineerId === assignment.userId) {
                await tx.project.update({
                    where: { id: assignment.projectId },
                    data: { engineerId: null },
                });
            }
            return updated;
        });
        return res.json({
            message: "Assignment removed successfully",
            assignment: removedAssignment,
        });
    }
    catch (error) {
        console.error("Delete project member error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
