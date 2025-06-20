"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertDateToIso = convertDateToIso;
function convertDateToIso(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error('Invalid date format. Expected "YYYY-MM-DD".');
    }
    const prismaDateTime = `${dateStr}T00:00:00.000Z`;
    return prismaDateTime;
}
