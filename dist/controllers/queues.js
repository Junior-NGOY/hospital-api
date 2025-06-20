"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueue = createQueue;
exports.updateQueue = updateQueue;
exports.deleteQueue = deleteQueue;
exports.getQueues = getQueues;
exports.addToQueue = addToQueue;
exports.getQueueDisplay = getQueueDisplay;
exports.getQueueDisplayAll = getQueueDisplayAll;
exports.callNextPatient = callNextPatient;
exports.updateQueueEntry = updateQueueEntry;
exports.getQueueById = getQueueById;
exports.transferPatient = transferPatient;
exports.getQueuesByDepartment = getQueuesByDepartment;
exports.getQueuesOverview = getQueuesOverview;
const db_1 = require("../db/db");
const calculateAge_1 = require("../utils/calculateAge");
function createQueue(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = req.body;
        try {
            if (!data.departmentId) {
                return res.status(400).json({
                    data: null,
                    error: "departmentId est requis"
                });
            }
            const newQueue = yield db_1.db.queue.create({
                data: {
                    name: data.name,
                    description: data.description,
                    departmentId: data.departmentId,
                    isActive: true
                }
            });
            console.log(`Queue created successfully: ${newQueue.name} (${newQueue.id})`);
            return res.status(201).json({
                data: newQueue,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function updateQueue(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const data = req.body;
        try {
            const updatedQueue = yield db_1.db.queue.update({
                where: { id },
                data: {
                    name: data.name,
                    description: data.description,
                    departmentId: data.departmentId,
                    isActive: data.isActive
                }
            });
            return res.status(200).json({
                data: updatedQueue,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function deleteQueue(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            yield db_1.db.queue.delete({
                where: { id }
            });
            return res.status(200).json({
                data: { success: true, message: "Queue deleted successfully" },
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getQueues(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const queues = yield db_1.db.queue.findMany({
                include: {
                    department: true,
                    hospital: true,
                    _count: {
                        select: {
                            entries: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            return res.status(200).json({
                data: queues,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function addToQueue(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = req.body;
        try {
            const maxTicket = yield db_1.db.queueEntry.findFirst({
                where: {
                    queueId: data.queueId,
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                },
                orderBy: { ticketNumber: 'desc' }
            });
            const nextNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
            const priority = data.priority || 'NORMAL';
            const newQueueEntry = yield db_1.db.queueEntry.create({
                data: {
                    queueId: data.queueId,
                    patientId: data.patientId,
                    status: data.status || 'WAITING',
                    priority: priority,
                    notes: data.notes,
                    ticketNumber: nextNumber
                },
                include: {
                    patient: true,
                    queue: true
                }
            });
            console.log(`Queue entry created successfully: ${newQueueEntry.id} with ticket number ${nextNumber}`);
            return res.status(201).json({
                data: newQueueEntry,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getQueueDisplay(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { queueId } = req.params;
        try {
            const queue = yield db_1.db.queue.findUnique({
                where: { id: queueId },
                include: {
                    department: true,
                }
            });
            if (!queue) {
                return res.status(404).json({
                    data: null,
                    error: "Queue not found"
                });
            }
            const activeEntries = yield db_1.db.queueEntry.findMany({
                where: {
                    queueId,
                    status: {
                        in: ['WAITING', 'IN_PROGRESS']
                    }
                },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            dateOfBirth: true,
                            gender: true,
                            phone: true,
                            email: true,
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            firstName: true,
                            role: true
                        }
                    }
                },
                orderBy: [
                    { priority: 'desc' },
                    { ticketNumber: 'asc' }
                ]
            });
            const waitingCount = activeEntries.filter(entry => entry.status === 'WAITING').length;
            const processingCount = activeEntries.filter(entry => entry.status === 'IN_PROGRESS').length;
            const completedEntriesToday = yield db_1.db.queueEntry.findMany({
                where: {
                    queueId,
                    status: 'COMPLETED',
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    },
                    completedAt: {
                        not: null
                    }
                },
                select: {
                    createdAt: true,
                    completedAt: true
                }
            });
            let averageWaitTime = 0;
            if (completedEntriesToday.length > 0) {
                const totalWaitTimeMs = completedEntriesToday.reduce((total, entry) => {
                    const waitTime = entry.completedAt.getTime() - entry.createdAt.getTime();
                    return total + waitTime;
                }, 0);
                averageWaitTime = Math.round(totalWaitTimeMs / completedEntriesToday.length / 60000);
            }
            const displayData = {
                queue: {
                    id: queue.id,
                    name: queue.name,
                    description: queue.description,
                    department: queue.department ? {
                        id: queue.department.id,
                        name: queue.department.name
                    } : null,
                    isActive: queue.isActive,
                },
                statistics: {
                    waitingCount,
                    processingCount,
                    totalActiveCount: waitingCount + processingCount,
                    averageWaitTimeMinutes: averageWaitTime
                },
                entries: activeEntries.map(entry => ({
                    id: entry.id,
                    ticketNumber: entry.ticketNumber,
                    status: entry.status,
                    priority: entry.priority,
                    createdAt: entry.createdAt,
                    waitingTime: Math.round((new Date().getTime() - entry.createdAt.getTime()) / 60000),
                    patient: {
                        id: entry.patient.id,
                        name: `${entry.patient.firstName} ${entry.patient.lastName}`,
                        displayName: `${entry.patient.firstName} ${entry.patient.lastName.charAt(0)}.`,
                        gender: entry.patient.gender,
                        age: (0, calculateAge_1.calculateAge)(entry.patient.dateOfBirth)
                    },
                    assignedTo: entry.assignedTo ? {
                        id: entry.assignedTo.id,
                        name: entry.assignedTo.firstName,
                        role: entry.assignedTo.role
                    } : null,
                    notes: entry.notes
                }))
            };
            return res.status(200).json({
                data: displayData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getQueueDisplayAll(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const queues = yield db_1.db.queue.findMany({
                where: {
                    isActive: true
                },
                include: {
                    department: true
                }
            });
            const queueDisplayData = yield Promise.all(queues.map((queue) => __awaiter(this, void 0, void 0, function* () {
                const queueConfiguration = yield db_1.db.queueConfiguration.findUnique({
                    where: { queueId: queue.id }
                });
                const activeEntries = yield db_1.db.queueEntry.findMany({
                    where: {
                        queueId: queue.id,
                        status: {
                            in: ['WAITING', 'IN_PROGRESS']
                        }
                    },
                    include: {
                        patient: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                dateOfBirth: true,
                                gender: true
                            }
                        },
                        assignedTo: {
                            select: {
                                id: true,
                                firstName: true,
                                role: true
                            }
                        }
                    },
                    orderBy: [
                        { priority: 'desc' },
                        { ticketNumber: 'asc' }
                    ]
                });
                const waitingCount = activeEntries.filter(entry => entry.status === 'WAITING').length;
                const processingCount = activeEntries.filter(entry => entry.status === 'IN_PROGRESS').length;
                return {
                    queue: {
                        id: queue.id,
                        name: queue.name,
                        description: queue.description,
                        department: queue.department ? {
                            id: queue.department.id,
                            name: queue.department.name
                        } : null,
                        isActive: queue.isActive,
                        configuration: queueConfiguration
                    },
                    statistics: {
                        waitingCount,
                        processingCount,
                        totalActiveCount: waitingCount + processingCount
                    },
                    entries: activeEntries.map(entry => ({
                        id: entry.id,
                        ticketNumber: entry.ticketNumber,
                        status: entry.status,
                        priority: entry.priority,
                        createdAt: entry.createdAt,
                        patient: {
                            id: entry.patient.id,
                            displayName: `${entry.patient.firstName} ${entry.patient.lastName.charAt(0)}.`,
                            gender: entry.patient.gender,
                            age: (0, calculateAge_1.calculateAge)(entry.patient.dateOfBirth)
                        },
                        assignedTo: entry.assignedTo ? {
                            id: entry.assignedTo.id,
                            name: entry.assignedTo.firstName,
                            role: entry.assignedTo.role
                        } : null
                    }))
                };
            })));
            return res.status(200).json({
                data: queueDisplayData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function callNextPatient(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const { queueId } = req.params;
        const { userId } = req.body;
        try {
            const queue = yield db_1.db.queue.findUnique({
                where: { id: queueId }
            });
            if (!queue) {
                return res.status(404).json({
                    data: null,
                    error: "Queue not found"
                });
            }
            const user = yield db_1.db.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                return res.status(404).json({
                    data: null,
                    error: "User not found"
                });
            }
            const nextPatient = yield db_1.db.queueEntry.findFirst({
                where: {
                    queueId,
                    status: 'WAITING'
                },
                orderBy: [
                    { priority: 'desc' },
                    { ticketNumber: 'asc' }
                ],
                include: {
                    patient: true,
                    queue: true
                }
            });
            if (!nextPatient) {
                return res.status(404).json({
                    data: null,
                    error: "No patients waiting in queue"
                });
            }
            const updatedEntry = yield db_1.db.queueEntry.update({
                where: { id: nextPatient.id },
                data: {
                    status: 'IN_PROGRESS',
                    assignedToId: userId,
                },
                include: {
                    patient: true,
                    queue: true,
                    assignedTo: true,
                }
            });
            console.log(`Patient ${updatedEntry.patient.firstName} ${updatedEntry.patient.lastName} (ID: ${updatedEntry.patient.id}) called by user ${userId} in queue ${queueId}`);
            const responseData = {
                id: updatedEntry.id,
                ticketNumber: updatedEntry.ticketNumber,
                status: updatedEntry.status,
                priority: updatedEntry.priority,
                createdAt: updatedEntry.createdAt,
                waitingTime: Math.round((new Date().getTime() - updatedEntry.createdAt.getTime()) / 60000),
                patient: {
                    id: updatedEntry.patient.id,
                    name: `${updatedEntry.patient.firstName} ${updatedEntry.patient.lastName}`,
                    gender: updatedEntry.patient.gender,
                    age: (0, calculateAge_1.calculateAge)(updatedEntry.patient.dateOfBirth)
                },
                queue: {
                    id: ((_a = updatedEntry.queue) === null || _a === void 0 ? void 0 : _a.id) || '',
                    name: ((_b = updatedEntry.queue) === null || _b === void 0 ? void 0 : _b.name) || 'Queue inconnue'
                },
                assignedTo: {
                    id: ((_c = updatedEntry === null || updatedEntry === void 0 ? void 0 : updatedEntry.assignedTo) === null || _c === void 0 ? void 0 : _c.id) || null,
                    name: (_d = updatedEntry === null || updatedEntry === void 0 ? void 0 : updatedEntry.assignedTo) === null || _d === void 0 ? void 0 : _d.firstName,
                    role: (_e = updatedEntry === null || updatedEntry === void 0 ? void 0 : updatedEntry.assignedTo) === null || _e === void 0 ? void 0 : _e.role
                },
                notes: updatedEntry.notes
            };
            return res.status(200).json({
                data: responseData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function updateQueueEntry(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { entryId } = req.params;
        const data = req.body;
        try {
            const existingEntry = yield db_1.db.queueEntry.findUnique({
                where: { id: entryId },
                include: {
                    patient: true,
                    queue: true
                }
            });
            if (!existingEntry) {
                return res.status(404).json({
                    data: null,
                    error: "Queue entry not found"
                });
            }
            const updateData = {};
            if (data.status) {
                updateData.status = data.status;
                if (data.status === 'COMPLETED' && existingEntry.status !== 'COMPLETED') {
                    updateData.completedAt = new Date();
                }
                if (data.status !== 'COMPLETED' && existingEntry.status === 'COMPLETED') {
                    updateData.completedAt = null;
                }
            }
            if (data.priority !== undefined) {
                if (typeof data.priority === 'number') {
                    updateData.priority = mapNumberToPriority(data.priority);
                }
                else {
                    updateData.priority = data.priority;
                }
            }
            if (data.notes !== undefined) {
                updateData.notes = data.notes;
            }
            if (data.assignedToId !== undefined) {
                updateData.assignedToId = data.assignedToId;
            }
            const updatedEntry = yield db_1.db.queueEntry.update({
                where: { id: entryId },
                data: updateData,
                include: {
                    patient: true,
                    queue: true,
                    assignedTo: true,
                }
            });
            console.log(`Queue entry ${entryId} updated: ${JSON.stringify(data)}`);
            const responseData = {
                id: updatedEntry.id,
                ticketNumber: updatedEntry.ticketNumber,
                status: updatedEntry.status,
                priority: updatedEntry.priority,
                createdAt: updatedEntry.createdAt,
                updatedAt: updatedEntry.updatedAt,
                completedAt: updatedEntry.completedAt,
                waitingTime: Math.round(((updatedEntry.completedAt || new Date()).getTime() -
                    updatedEntry.createdAt.getTime()) / 60000),
                patient: {
                    id: updatedEntry.patient.id,
                    name: `${updatedEntry.patient.firstName} ${updatedEntry.patient.lastName}`,
                    gender: updatedEntry.patient.gender,
                    age: (0, calculateAge_1.calculateAge)(updatedEntry.patient.dateOfBirth)
                }, queue: {
                    id: ((_a = updatedEntry.queue) === null || _a === void 0 ? void 0 : _a.id) || '',
                    name: ((_b = updatedEntry.queue) === null || _b === void 0 ? void 0 : _b.name) || 'Queue inconnue'
                },
                assignedTo: updatedEntry.assignedTo ? {
                    id: updatedEntry.assignedTo.id,
                    name: updatedEntry.assignedTo.firstName,
                    role: updatedEntry.assignedTo.role
                } : null,
                notes: updatedEntry.notes
            };
            return res.status(200).json({
                data: responseData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function mapNumberToPriority(priorityNumber) {
    switch (priorityNumber) {
        case 0: return 'LOW';
        case 1: return 'NORMAL';
        case 2: return 'HIGH';
        case 3: return 'URGENT';
        default: return 'NORMAL';
    }
}
function getQueueById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { queueId } = req.params;
        try {
            const queue = yield db_1.db.queue.findUnique({
                where: { id: queueId },
                include: {
                    department: true,
                    queueConfiguration: true
                }
            });
            if (!queue) {
                return res.status(404).json({
                    data: null,
                    error: "Queue not found"
                });
            }
            const queueEntries = yield db_1.db.queueEntry.findMany({
                where: { queueId },
                include: {
                    patient: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            dateOfBirth: true,
                            gender: true,
                            email: true,
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            firstName: true,
                            role: true
                        }
                    },
                },
                orderBy: [
                    { status: 'asc' },
                    { priority: 'desc' },
                    { ticketNumber: 'asc' }
                ]
            });
            const waitingCount = queueEntries.filter(entry => entry.status === 'WAITING').length;
            const processingCount = queueEntries.filter(entry => entry.status === 'IN_PROGRESS').length;
            const completedCount = queueEntries.filter(entry => entry.status === 'COMPLETED').length;
            const cancelledCount = queueEntries.filter(entry => entry.status === 'CANCELLED' || entry.status === 'NO_SHOW').length;
            const completedEntriesToday = queueEntries.filter(entry => entry.status === 'COMPLETED' &&
                entry.completedAt &&
                entry.createdAt.toDateString() === new Date().toDateString());
            let averageWaitTime = 0;
            if (completedEntriesToday.length > 0) {
                const totalWaitTimeMs = completedEntriesToday.reduce((total, entry) => {
                    const waitTime = entry.completedAt.getTime() - entry.createdAt.getTime();
                    return total + waitTime;
                }, 0);
                averageWaitTime = Math.round(totalWaitTimeMs / completedEntriesToday.length / 60000);
            }
            const formattedEntries = queueEntries.map(entry => {
                const waitingTime = entry.completedAt
                    ? Math.round((entry.completedAt.getTime() - entry.createdAt.getTime()) / 60000)
                    : Math.round((new Date().getTime() - entry.createdAt.getTime()) / 60000);
                return {
                    id: entry.id,
                    ticketNumber: entry.ticketNumber,
                    status: entry.status,
                    priority: entry.priority,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    completedAt: entry.completedAt,
                    waitingTime: waitingTime,
                    patient: {
                        id: entry.patient.id,
                        name: `${entry.patient.firstName} ${entry.patient.lastName}`,
                        gender: entry.patient.gender,
                        age: (0, calculateAge_1.calculateAge)(entry.patient.dateOfBirth),
                        email: entry.patient.email,
                    },
                    assignedTo: entry.assignedTo ? {
                        id: entry.assignedTo.id,
                        name: entry.assignedTo.firstName,
                        role: entry.assignedTo.role
                    } : null,
                    notes: entry.notes
                };
            });
            const responseData = {
                queue: {
                    id: queue.id,
                    name: queue.name,
                    description: queue.description,
                    department: queue.department ? {
                        id: queue.department.id,
                        name: queue.department.name
                    } : null,
                    isActive: queue.isActive,
                    createdAt: queue.createdAt,
                    updatedAt: queue.updatedAt,
                    configuration: queue.queueConfiguration
                },
                statistics: {
                    waitingCount,
                    processingCount,
                    completedCount,
                    cancelledCount,
                    totalCount: queueEntries.length,
                    averageWaitTimeMinutes: averageWaitTime
                },
                entries: formattedEntries
            };
            return res.status(200).json({
                data: responseData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function transferPatient(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const { entryId } = req.params;
        const { targetQueueId } = req.body;
        try {
            const entry = yield db_1.db.queueEntry.findUnique({
                where: { id: entryId },
                include: {
                    patient: true,
                    queue: true
                }
            });
            if (!entry) {
                return res.status(404).json({
                    data: null,
                    error: "Queue entry not found"
                });
            }
            const targetQueue = yield db_1.db.queue.findUnique({
                where: { id: targetQueueId }
            });
            if (!targetQueue) {
                return res.status(404).json({
                    data: null,
                    error: "Target queue not found"
                });
            }
            const maxTicket = yield db_1.db.queueEntry.findFirst({
                where: { queueId: targetQueueId }, orderBy: { ticketNumber: 'desc' }
            });
            const nextNumber = maxTicket ? (maxTicket.ticketNumber || 0) + 1 : 1;
            const newEntry = yield db_1.db.queueEntry.create({
                data: {
                    queueId: targetQueueId,
                    patientId: entry.patientId,
                    status: 'WAITING',
                    priority: entry.priority,
                    notes: `Transféré depuis ${((_a = entry.queue) === null || _a === void 0 ? void 0 : _a.name) || 'Queue inconnue'}. Notes originales: ${entry.notes || 'Aucune'}`,
                    ticketNumber: nextNumber
                },
                include: {
                    patient: true,
                    queue: true
                }
            });
            yield db_1.db.queueEntry.update({
                where: { id: entryId },
                data: {
                    status: 'CANCELLED',
                    notes: `${entry.notes || ''} Transféré vers ${targetQueue.name}.`
                }
            });
            const responseData = {
                originalEntry: {
                    id: entry.id,
                    queueId: entry.queueId,
                    queueName: ((_b = entry.queue) === null || _b === void 0 ? void 0 : _b.name) || 'Queue inconnue',
                    status: 'CANCELLED'
                },
                newEntry: {
                    id: newEntry.id,
                    queueId: newEntry.queueId,
                    queueName: ((_c = newEntry.queue) === null || _c === void 0 ? void 0 : _c.name) || 'Queue inconnue',
                    ticketNumber: nextNumber,
                    status: 'WAITING'
                },
                patient: {
                    id: entry.patient.id,
                    name: `${entry.patient.firstName} ${entry.patient.lastName}`
                }
            };
            return res.status(200).json({
                data: responseData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getQueuesByDepartment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { departmentId } = req.params;
        try {
            const department = yield db_1.db.department.findUnique({
                where: { id: departmentId }
            });
            if (!department) {
                return res.status(404).json({
                    data: null,
                    error: "Department not found"
                });
            }
            const queues = yield db_1.db.queue.findMany({
                where: { departmentId },
                include: {
                    queueConfiguration: true, _count: {
                        select: {
                            entries: true
                        }
                    }
                }
            });
            const formattedQueues = queues.map(queue => ({
                id: queue.id,
                name: queue.name,
                description: queue.description,
                isActive: queue.isActive,
                createdAt: queue.createdAt,
                updatedAt: queue.updatedAt,
            }));
            const responseData = {
                department: {
                    id: department.id,
                    name: department.name
                },
                queues: formattedQueues
            };
            return res.status(200).json({
                data: responseData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
function getQueuesOverview(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const queues = yield db_1.db.queue.findMany({
                where: { isActive: true },
                include: {
                    department: true,
                    queueConfiguration: true
                }
            });
            const queueStats = yield Promise.all(queues.map((queue) => __awaiter(this, void 0, void 0, function* () {
                const waitingCount = yield db_1.db.queueEntry.count({
                    where: {
                        queueId: queue.id,
                        status: 'WAITING'
                    }
                });
                const processingCount = yield db_1.db.queueEntry.count({
                    where: {
                        queueId: queue.id,
                        status: 'IN_PROGRESS'
                    }
                });
                const completedEntriesToday = yield db_1.db.queueEntry.findMany({
                    where: {
                        queueId: queue.id,
                        status: 'COMPLETED',
                        completedAt: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0))
                        }
                    },
                    select: {
                        createdAt: true,
                        completedAt: true
                    }
                });
                let averageWaitTime = 0;
                if (completedEntriesToday.length > 0) {
                    const totalWaitTimeMs = completedEntriesToday.reduce((total, entry) => {
                        const waitTime = entry.completedAt.getTime() - entry.createdAt.getTime();
                        return total + waitTime;
                    }, 0);
                    averageWaitTime = Math.round(totalWaitTimeMs / completedEntriesToday.length / 60000);
                }
                return {
                    id: queue.id,
                    name: queue.name,
                    description: queue.description,
                    department: queue.department ? {
                        id: queue.department.id,
                        name: queue.department.name
                    } : null,
                    isActive: queue.isActive,
                    statistics: {
                        waitingCount,
                        processingCount,
                        totalActiveCount: waitingCount + processingCount,
                        averageWaitTimeMinutes: averageWaitTime
                    }
                };
            })));
            const totalWaiting = queueStats.reduce((sum, queue) => sum + queue.statistics.waitingCount, 0);
            const totalProcessing = queueStats.reduce((sum, queue) => sum + queue.statistics.processingCount, 0);
            const totalActive = totalWaiting + totalProcessing;
            const responseData = {
                timestamp: new Date(),
                summary: {
                    totalQueues: queues.length,
                    totalWaiting,
                    totalProcessing,
                    totalActive
                },
                queues: queueStats
            };
            return res.status(200).json({
                data: responseData,
                error: null
            });
        }
        catch (error) {
            console.log(error);
            return res.status(500).json({
                data: null,
                error: "Something went wrong"
            });
        }
    });
}
