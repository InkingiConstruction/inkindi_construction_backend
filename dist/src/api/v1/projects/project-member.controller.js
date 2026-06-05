"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProjectMember = exports.rejectProjectMember = exports.acceptProjectMember = exports.updateProjectMember = exports.getProjectMemberById = exports.getProjectMembers = exports.createProjectMember = void 0;
const db_js_1 = __importDefault(require("../../../config/db.js"));
const cache_service_js_1 = require("../../../common/services/cache.service.js");
const notifications_js_1 = require("../../../lib/notifications.js");
const getParamId = (id) => Array.isArray(id) ? id[0] : id;
const projectTeamRoles = ["engineer", "supervisor"];
const canManageProjectMember = (project, userId, role) => {
    const normalizedRole = String(role || "").trim().toLowerCase();
    if (normalizedRole === "admin")
        return true;
    if (normalizedRole === "client")
        return project.clientId === userId;
    if (normalizedRole === "engineer")
        return project.engineerId === userId;
    return false;
};
const refreshProjectActivation = async (tx, projectId) => {
    const accepted = await tx.projectMember.findMany({
        where: {
            projectId,
            role: { in: [...projectTeamRoles] },
            status: "accepted",
        },
        select: { role: true },
    });
    const acceptedRoles = new Set(accepted.map((member) => member.role));
    const bothCoreAssigneesAccepted = projectTeamRoles.every((role) => acceptedRoles.has(role));
    if (!bothCoreAssigneesAccepted)
        return false;
    const updated = await tx.project.updateMany({
        where: {
            id: projectId,
            status: "draft",
        },
        data: {
            status: "active",
        },
    });
    return updated.count > 0;
};
const createProjectMember = async (req, res) => {
    try {
        const { projectId, userId } = req.body;
        const role = String(req.body.role || "engineer").trim().toLowerCase();
        if (!projectId || !userId) {
            return res
                .status(400)
                .json({ message: "projectId and userId are required" });
        }
        let project = await db_js_1.default.project.findUnique({
            where: { id: String(projectId) },
        });
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        const currentRole = String(req.user.role || "").trim().toLowerCase();
        if (currentRole !== "admin" && project.clientId !== req.user.id) {
            return res.status(403).json({
                message: "Only the project owner client can assign project team members",
                projectClientId: project.clientId,
                currentUserId: req.user.id,
                currentRole: req.user.role,
            });
        }
        const user = await db_js_1.default.user.findUnique({
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
        if (String(user.role).trim().toLowerCase() !== role) {
            return res.status(400).json({
                message: `Selected user is not a ${role}`,
                selectedUserId: user.id,
                selectedUserEmail: user.email,
                selectedUserRole: user.role,
                requiredRole: role,
            });
        }
        if (role === "engineer" && project.engineerId) {
            const acceptedEngineerAssignment = await db_js_1.default.projectMember.findFirst({
                where: {
                    projectId: project.id,
                    userId: project.engineerId,
                    role: "engineer",
                    status: "accepted",
                },
            });
            if (acceptedEngineerAssignment && project.engineerId !== user.id) {
                return res.status(400).json({
                    message: "Project already has an accepted engineer",
                    currentEngineerId: project.engineerId,
                    currentAssignmentId: acceptedEngineerAssignment.id,
                });
            }
            if (!acceptedEngineerAssignment) {
                project = await db_js_1.default.project.update({
                    where: { id: project.id },
                    data: { engineerId: null },
                });
            }
        }
        const existingAssignment = await db_js_1.default.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId: project.id,
                    userId: user.id,
                },
            },
        });
        if (existingAssignment?.status === "accepted") {
            return res.status(400).json({
                message: `This ${role} has already accepted this project`,
                assignment: existingAssignment,
            });
        }
        const assignment = await db_js_1.default.projectMember.upsert({
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
        cache_service_js_1.cacheStore.clear();
        await (0, notifications_js_1.notifyUser)({
            userId: assignment.userId,
            title: "Project invitation",
            body: `You were invited as ${assignment.role} for ${assignment.project.name}`,
            data: {
                type: "project_assignment_invited",
                projectId: assignment.projectId,
                assignmentId: assignment.id,
                role: assignment.role,
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
exports.createProjectMember = createProjectMember;
const getProjectMembers = async (req, res) => {
    try {
        const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const assignments = await db_js_1.default.projectMember.findMany({
            where: {
                ...(projectId ? { projectId } : {}),
                ...(status ? { status: status } : {}),
                ...(String(req.user.role || "").trim().toLowerCase() === "admin"
                    ? {}
                    : String(req.user.role || "").trim().toLowerCase() === "client"
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
exports.getProjectMembers = getProjectMembers;
const getProjectMemberById = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await db_js_1.default.projectMember.findUnique({
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
        const canRead = String(req.user.role || "").trim().toLowerCase() === "admin" ||
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
exports.getProjectMemberById = getProjectMemberById;
const updateProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        const { role, status } = req.body;
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const existingAssignment = await db_js_1.default.projectMember.findUnique({
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
        const assignment = await db_js_1.default.projectMember.update({
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
        cache_service_js_1.cacheStore.clear();
        if (status !== undefined) {
            await (0, notifications_js_1.notifyUsers)([assignment.userId, assignment.project.clientId, assignment.project.engineerId].filter((userId) => Boolean(userId && userId !== req.user.id)), {
                title: "Assignment updated",
                body: `${assignment.role} assignment for ${assignment.project.name} is now ${assignment.status}`,
                data: {
                    type: "project_assignment_status_updated",
                    projectId: assignment.projectId,
                    assignmentId: assignment.id,
                    role: assignment.role,
                    status: assignment.status,
                },
            });
        }
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
exports.updateProjectMember = updateProjectMember;
const acceptProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await db_js_1.default.projectMember.findUnique({
            where: { id },
            include: { project: true },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        if (assignment.userId !== req.user.id &&
            String(req.user.role || "").trim().toLowerCase() !== "admin") {
            return res.status(403).json({
                message: "Only the invited project member or admin can accept this assignment",
            });
        }
        if (assignment.status !== "pending") {
            return res.status(400).json({
                message: "Only pending assignments can be accepted",
            });
        }
        const activation = { becameActive: false };
        const acceptedAssignment = await db_js_1.default.$transaction(async (tx) => {
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
            }
            activation.becameActive = await refreshProjectActivation(tx, updated.projectId);
            if (updated.role === "engineer" || updated.role === "supervisor") {
                await tx.projectMember.updateMany({
                    where: {
                        projectId: updated.projectId,
                        role: updated.role,
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
        cache_service_js_1.cacheStore.clear();
        await (0, notifications_js_1.notifyUsers)([acceptedAssignment.project.clientId, acceptedAssignment.project.engineerId].filter((userId) => Boolean(userId && userId !== acceptedAssignment.userId)), {
            title: "Project invitation accepted",
            body: `${acceptedAssignment.user.name} accepted the ${acceptedAssignment.role} invitation for ${acceptedAssignment.project.name}`,
            data: {
                type: "project_assignment_accepted",
                projectId: acceptedAssignment.projectId,
                assignmentId: acceptedAssignment.id,
                role: acceptedAssignment.role,
                userId: acceptedAssignment.userId,
            },
        });
        if (activation.becameActive) {
            await (0, notifications_js_1.notifyProjectParticipants)({
                projectId: acceptedAssignment.projectId,
                excludeUserId: acceptedAssignment.userId,
                title: "Project is active",
                body: `${acceptedAssignment.project.name} is now active`,
                data: {
                    type: "project_activated",
                    assignmentId: acceptedAssignment.id,
                },
            });
        }
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
exports.acceptProjectMember = acceptProjectMember;
const rejectProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await db_js_1.default.projectMember.findUnique({
            where: { id },
            include: { project: true },
        });
        if (!assignment) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        if (assignment.userId !== req.user.id &&
            String(req.user.role || "").trim().toLowerCase() !== "admin") {
            return res.status(403).json({
                message: "Only the invited project member or admin can reject this assignment",
            });
        }
        if (assignment.status !== "pending") {
            return res.status(400).json({
                message: "Only pending assignments can be rejected",
            });
        }
        const rejectedAssignment = await db_js_1.default.projectMember.update({
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
        cache_service_js_1.cacheStore.clear();
        await (0, notifications_js_1.notifyUsers)([rejectedAssignment.project.clientId, rejectedAssignment.project.engineerId].filter((userId) => Boolean(userId && userId !== rejectedAssignment.userId)), {
            title: "Project invitation rejected",
            body: `${rejectedAssignment.user.name} rejected the ${rejectedAssignment.role} invitation for ${rejectedAssignment.project.name}`,
            data: {
                type: "project_assignment_rejected",
                projectId: rejectedAssignment.projectId,
                assignmentId: rejectedAssignment.id,
                role: rejectedAssignment.role,
                userId: rejectedAssignment.userId,
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
exports.rejectProjectMember = rejectProjectMember;
const deleteProjectMember = async (req, res) => {
    try {
        const id = getParamId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Assignment ID is required" });
        }
        const assignment = await db_js_1.default.projectMember.findUnique({
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
        const removedAssignment = await db_js_1.default.$transaction(async (tx) => {
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
        cache_service_js_1.cacheStore.clear();
        await (0, notifications_js_1.notifyUser)({
            userId: assignment.userId,
            title: "Project assignment removed",
            body: `Your ${assignment.role} assignment for ${assignment.project.name} was removed`,
            data: {
                type: "project_assignment_removed",
                projectId: assignment.projectId,
                assignmentId: assignment.id,
                role: assignment.role,
            },
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
exports.deleteProjectMember = deleteProjectMember;
