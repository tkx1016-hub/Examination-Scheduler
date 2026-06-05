/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Teacher {
  id: string;
  name: string;
  active: boolean;
  dutyCount: number;
}

export interface Exam {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  subject: string;
  duration: number; // minutes
  invigilators: string[]; // Teacher IDs
}

export interface SubjectInput {
  id: string;
  name: string;
  duration: number; // minutes
}

export interface TimeSlot {
  name: string;
  start: string; // "07:30"
  end: string; // "12:15"
  startMinutes: number; // minutes from midnight
  endMinutes: number; // minutes from midnight
}

export const VALID_SLOTS: TimeSlot[] = [
  { name: "上午 (Morning)", start: "07:30", end: "12:15", startMinutes: 7 * 60 + 30, endMinutes: 12 * 60 + 15 },
  { name: "下午 (Afternoon)", start: "14:00", end: "18:00", startMinutes: 14 * 60 + 0, endMinutes: 18 * 60 + 0 },
  { name: "晚上 (Evening)", start: "19:00", end: "22:00", startMinutes: 19 * 60 + 0, endMinutes: 22 * 60 + 0 },
];
