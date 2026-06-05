/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Teacher, Exam, SubjectInput, VALID_SLOTS } from "../types";

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Check if a date is weekend (0 = Sunday, 6 = Saturday)
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export interface SchedulerConfig {
  startDate: string;
  endDate?: string;
  teachersPerExam: number;
  bufferMinutes: number;
  skipWeekends: boolean;
  clearExistingDuties: boolean;
}

export interface AutoScheduleResult {
  exams: Exam[];
  updatedTeachers: Teacher[];
}

/**
 * Packs subjects into the daily slots and distributes invigilators evenly.
 */
export function autoScheduleExams(
  subjects: SubjectInput[],
  teachers: Teacher[],
  config: SchedulerConfig
): AutoScheduleResult {
  const { startDate, teachersPerExam = 1, bufferMinutes = 15, skipWeekends = true, clearExistingDuties = true } = config;

  // Clone teachers and optionally reset their duty counts
  const teachersPool = teachers.map((t) => ({
    ...t,
    dutyCount: clearExistingDuties ? 0 : t.dutyCount,
  }));

  // Filter out inactive teachers for invigilation assignment
  const activeTeachers = teachersPool.filter((t) => t.active);

  const scheduledExams: Exam[] = [];

  // Check if we should distribute subjects evenly over a specific date range (when endDate is specified)
  const hasValidEndDate = config.endDate && config.endDate.trim() !== "";

  if (hasValidEndDate) {
    const endLimitDate = new Date(config.endDate!);
    const firstDate = new Date(startDate);
    
    firstDate.setHours(0, 0, 0, 0);
    endLimitDate.setHours(0, 0, 0, 0);

    if (endLimitDate >= firstDate) {
      // 1. Gather all active dates in the range
      const activeDates: string[] = [];
      const tempDate = new Date(firstDate);
      while (tempDate <= endLimitDate) {
        if (!skipWeekends || !isWeekend(tempDate)) {
          activeDates.push(formatDate(tempDate));
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }

      if (activeDates.length > 0) {
        // 2. Distribute subjects evenly into these days (consecutive chunking)
        const numDays = activeDates.length;
        const subjectsPerDay: SubjectInput[][] = Array.from({ length: numDays }, () => []);
        
        const n = subjects.length;
        let currentSubIdx = 0;
        for (let i = 0; i < numDays; i++) {
          const count = Math.ceil((n - currentSubIdx) / (numDays - i));
          for (let j = 0; j < count; j++) {
            if (currentSubIdx < n) {
              subjectsPerDay[i].push(subjects[currentSubIdx]);
              currentSubIdx++;
            }
          }
        }

        // 3. For each active date, schedule its assigned subjects
        for (let i = 0; i < numDays; i++) {
          const dayStr = activeDates[i];
          const daySubjects = subjectsPerDay[i];
          
          let currentSlotIdx = 0;
          let currentMinutesInSlot = VALID_SLOTS[currentSlotIdx].startMinutes;

          for (const subject of daySubjects) {
            if (subject.duration <= 0) continue;

            let placed = false;
            let fallbackCounter = 0;

            while (!placed && fallbackCounter < 1000) {
              fallbackCounter++;
              const currentSlot = VALID_SLOTS[currentSlotIdx];

              // Check if subject duration strictly exceeds the core size of this session
              const maxSlotSpan = currentSlot.endMinutes - currentSlot.startMinutes;
              if (subject.duration > maxSlotSpan) {
                const canFitAnywhere = VALID_SLOTS.some(s => (s.endMinutes - s.startMinutes) >= subject.duration);
                if (!canFitAnywhere) {
                  // Force schedule at the beginning of the largest slot
                  const startMin = currentSlot.startMinutes;
                  const endMin = startMin + subject.duration;
                  
                  const assignedInvigilators: string[] = [];
                  if (activeTeachers.length > 0) {
                    activeTeachers.sort((a, b) => {
                      if (a.dutyCount !== b.dutyCount) {
                        return a.dutyCount - b.dutyCount;
                      }
                      return Math.random() - 0.5;
                    });
                    const chosen = activeTeachers.slice(0, Math.min(teachersPerExam, activeTeachers.length));
                    chosen.forEach((t) => {
                      t.dutyCount += 1;
                      assignedInvigilators.push(t.id);
                    });
                  }

                  scheduledExams.push({
                    id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    date: dayStr,
                    startTime: minutesToTime(startMin),
                    endTime: minutesToTime(endMin),
                    subject: subject.name,
                    duration: subject.duration,
                    invigilators: assignedInvigilators,
                  });

                  currentSlotIdx++;
                  if (currentSlotIdx >= VALID_SLOTS.length) {
                    currentSlotIdx = VALID_SLOTS.length - 1; // Stay on the last slot
                  }
                  currentMinutesInSlot = VALID_SLOTS[currentSlotIdx].startMinutes;
                  placed = true;
                  continue;
                }
              }

              // Check if it fits in current slot's remaining time
              if (currentMinutesInSlot + subject.duration <= currentSlot.endMinutes) {
                const startMin = currentMinutesInSlot;
                const endMin = startMin + subject.duration;

                const assignedInvigilators: string[] = [];
                if (activeTeachers.length > 0) {
                  activeTeachers.sort((a, b) => {
                    if (a.dutyCount !== b.dutyCount) {
                      return a.dutyCount - b.dutyCount;
                    }
                    return Math.random() - 0.5;
                  });

                  const chosen = activeTeachers.slice(0, Math.min(teachersPerExam, activeTeachers.length));
                  chosen.forEach((t) => {
                    t.dutyCount += 1;
                    assignedInvigilators.push(t.id);
                  });
                }

                scheduledExams.push({
                  id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  date: dayStr,
                  startTime: minutesToTime(startMin),
                  endTime: minutesToTime(endMin),
                  subject: subject.name,
                  duration: subject.duration,
                  invigilators: assignedInvigilators,
                });

                currentMinutesInSlot = endMin + bufferMinutes;
                placed = true;
              } else {
                // Move to next slot of the SAME day
                if (currentSlotIdx < VALID_SLOTS.length - 1) {
                  currentSlotIdx++;
                  currentMinutesInSlot = VALID_SLOTS[currentSlotIdx].startMinutes;
                } else {
                  // Already at the last slot, force schedule and allow overflow in evening slot
                  const startMin = currentMinutesInSlot;
                  const endMin = startMin + subject.duration;

                  const assignedInvigilators: string[] = [];
                  if (activeTeachers.length > 0) {
                    activeTeachers.sort((a, b) => {
                      if (a.dutyCount !== b.dutyCount) {
                        return a.dutyCount - b.dutyCount;
                      }
                      return Math.random() - 0.5;
                    });

                    const chosen = activeTeachers.slice(0, Math.min(teachersPerExam, activeTeachers.length));
                    chosen.forEach((t) => {
                      t.dutyCount += 1;
                      assignedInvigilators.push(t.id);
                    });
                  }

                  scheduledExams.push({
                    id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    date: dayStr,
                    startTime: minutesToTime(startMin),
                    endTime: minutesToTime(endMin),
                    subject: subject.name,
                    duration: subject.duration,
                    invigilators: assignedInvigilators,
                  });

                  currentMinutesInSlot = endMin + bufferMinutes;
                  placed = true;
                }
              }
            }
          }
        }

        // Update original list of teachers with new counts
        const finalTeachers = teachers.map((original) => {
          const updated = teachersPool.find((t) => t.id === original.id);
          return updated ? updated : original;
        });

        return {
          exams: scheduledExams,
          updatedTeachers: finalTeachers,
        };
      }
    }
  }

  // FALLBACK OR OLD MODE: Continuous packaging across infinite consecutive dates
  let currentDate = new Date(startDate);
  
  // Handlers for date skipping
  const advanceDate = (d: Date) => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    while (skipWeekends && isWeekend(next)) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  };

  // If start date falls on weekend and skipWeekends is enabled, slide it forward to Monday
  if (skipWeekends && isWeekend(currentDate)) {
    while (isWeekend(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  let currentSlotIdx = 0;
  let currentMinutesInSlot = VALID_SLOTS[currentSlotIdx].startMinutes;

  // Process each subject sequentially
  for (const subject of subjects) {
    if (subject.duration <= 0) continue;

    let placed = false;
    let fallbackCounter = 0; // prevent infinite loops
    
    while (!placed && fallbackCounter < 1000) {
      fallbackCounter++;
      const currentSlot = VALID_SLOTS[currentSlotIdx];
      
      // Calculate max available duration in this slot
      const maxSlotSpan = currentSlot.endMinutes - currentSlot.startMinutes;
      if (subject.duration > maxSlotSpan) {
        // If subject duration strictly exceeds the core size of this session,
        // it can never fit. We will schedule it but cap it or move to next slot/overflow
        const canFitAnywhere = VALID_SLOTS.some(s => (s.endMinutes - s.startMinutes) >= subject.duration);
        if (!canFitAnywhere) {
          // Force schedule at the beginning of the largest slot
          const startMin = currentSlot.startMinutes;
          const endMin = startMin + subject.duration;
          
          const assignedInvigilators: string[] = [];
          if (activeTeachers.length > 0) {
            // Sort by duties ascending
            activeTeachers.sort((a, b) => a.dutyCount - b.dutyCount);
            const chosen = activeTeachers.slice(0, Math.min(teachersPerExam, activeTeachers.length));
            chosen.forEach((t) => {
              t.dutyCount += 1;
              assignedInvigilators.push(t.id);
            });
          }

          scheduledExams.push({
            id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: formatDate(currentDate),
            startTime: minutesToTime(startMin),
            endTime: minutesToTime(endMin),
            subject: subject.name,
            duration: subject.duration,
            invigilators: assignedInvigilators,
          });

          // Move immediately to next slot since this one is totally filled & overflowed
          currentSlotIdx++;
          if (currentSlotIdx >= VALID_SLOTS.length) {
            currentSlotIdx = 0;
            currentDate = advanceDate(currentDate);
          }
          currentMinutesInSlot = VALID_SLOTS[currentSlotIdx].startMinutes;
          placed = true;
          continue;
        }
      }

      // Check if it fits in current slot's remaining time
      if (currentMinutesInSlot + subject.duration <= currentSlot.endMinutes) {
        const startMin = currentMinutesInSlot;
        const endMin = startMin + subject.duration;

        // Assign invigilators
        const assignedInvigilators: string[] = [];
        if (activeTeachers.length > 0) {
          // Sort active teachers by dutyCount ascending to ensure load balancing.
          activeTeachers.sort((a, b) => {
            if (a.dutyCount !== b.dutyCount) {
              return a.dutyCount - b.dutyCount;
            }
            return Math.random() - 0.5; // randomized tie-breaker
          });

          const chosen = activeTeachers.slice(0, Math.min(teachersPerExam, activeTeachers.length));
          chosen.forEach((t) => {
            t.dutyCount += 1;
            assignedInvigilators.push(t.id);
          });
        }

        scheduledExams.push({
          id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: formatDate(currentDate),
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          subject: subject.name,
          duration: subject.duration,
          invigilators: assignedInvigilators,
          });

        // Set pointer for next exam
        currentMinutesInSlot = endMin + bufferMinutes;
        placed = true;
      } else {
        // Move to next slot
        currentSlotIdx++;
        if (currentSlotIdx >= VALID_SLOTS.length) {
          currentSlotIdx = 0;
          currentDate = advanceDate(currentDate);
        }
        currentMinutesInSlot = VALID_SLOTS[currentSlotIdx].startMinutes;
      }
    }
  }

  // Update original list of teachers with new counts
  const finalTeachers = teachers.map((original) => {
    const updated = teachersPool.find((t) => t.id === original.id);
    return updated ? updated : original;
  });

  return {
    exams: scheduledExams,
    updatedTeachers: finalTeachers,
  };
}

/**
 * Cascade-shifts subsequent exams on the same date when one is moved/inserted or its time is changed.
 */
export function cascadeShiftExams(
  allExams: Exam[],
  changedExamId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  bufferMinutes: number = 15
): Exam[] {
  const startMin = timeToMinutes(newStartTime);
  let endMin = timeToMinutes(newEndTime);
  if (endMin < startMin) {
    endMin += 1440;
  }
  const newDuration = endMin - startMin;

  // 1. Modify the target exam with new timing details
  let updatedExams = allExams.map((e) => {
    if (e.id === changedExamId) {
      return {
        ...e,
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        duration: newDuration > 0 ? newDuration : e.duration,
      };
    }
    return e;
  });

  // 2. Perform cascading adjustments for any exam on the new target date
  const sameDayExams = updatedExams.filter((e) => e.date === newDate);
  const otherDayExams = updatedExams.filter((e) => e.date !== newDate);

  // Sort them by their startTime before changes, except let's place the updated exam at its correct slot,
  // and resolve overlaps subsequent to it.
  // We want to sort all of them. To respect the drag operation or user intent, sorting by start time works perfectly.
  sameDayExams.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Find index of the edited exam in the sorted array
  const targetIndex = sameDayExams.findIndex((e) => e.id === changedExamId);
  if (targetIndex !== -1) {
    // Iterate forward and shift any subsequent exam that overlaps
    for (let i = targetIndex + 1; i < sameDayExams.length; i++) {
      const prevExam = sameDayExams[i - 1];
      const currExam = sameDayExams[i];

      const prevEndMin = timeToMinutes(prevExam.endTime);
      const currStartMin = timeToMinutes(currExam.startTime);

      // Overlap detection
      if (currStartMin < prevEndMin + bufferMinutes) {
        const finalStartMin = prevEndMin + bufferMinutes;
        const finalEndMin = finalStartMin + currExam.duration;

        sameDayExams[i] = {
          ...currExam,
          startTime: minutesToTime(finalStartMin % 1440),
          endTime: minutesToTime(finalEndMin % 1440),
        };
      }
    }
  }

  return [...otherDayExams, ...sameDayExams];
}

export function getSlotIndex(startTimeStr: string): number {
  const mins = timeToMinutes(startTimeStr);
  if (mins < 13 * 60) return 0; // Morning
  if (mins < 18 * 60 + 30) return 1; // Afternoon
  return 2; // Evening
}

export function getNextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function cascadeShiftWithSlots(
  allExams: Exam[],
  draggedExamId: string,
  targetDate: string,
  targetSlotIdx: number,
  bufferMinutes: number = 15
): Exam[] {
  // Locate the dragged exam
  const draggedExam = allExams.find((e) => e.id === draggedExamId);
  if (!draggedExam) return allExams;

  // Split into untouched and rest:
  // untouched: exams whose date is strictly before targetDate (and is not draggedExam)
  const untouchedExams = allExams.filter(
    (e) => e.date < targetDate && e.id !== draggedExamId
  );
  
  // rest: exams whose date is >= targetDate (excluding draggedExam itself)
  const restExams = allExams.filter(
    (e) => e.date >= targetDate && e.id !== draggedExamId
  );

  // Group restExams into pre-existing buckets by (date, slotIdx)
  const bucketMap = new Map<string, Exam[]>();
  restExams.forEach((e) => {
    const slotIdx = getSlotIndex(e.startTime);
    const key = `${e.date}_${slotIdx}`;
    if (!bucketMap.has(key)) {
      bucketMap.set(key, []);
    }
    bucketMap.get(key)!.push(e);
  });

  // Sort each pre-existing bucket's exams by their original start time so we respect original order
  bucketMap.forEach((examsList) => {
    examsList.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  });

  // Now, inject draggedExam at the beginning of the target bucket
  const targetKey = `${targetDate}_${targetSlotIdx}`;
  if (!bucketMap.has(targetKey)) {
    bucketMap.set(targetKey, []);
  }
  // The dragged exam is placed FIRST in this bucket, representing the dropped action
  bucketMap.get(targetKey)!.unshift(draggedExam);

  // Clean list of newly assigned exams
  const updatedExams: Exam[] = [];

  // Start "flow-fill" loop
  let currDate = targetDate;
  let currSlotIdx = targetSlotIdx;
  
  // We keep a queue of exams to schedule
  const queue: Exam[] = [];
  
  // Fill the queue with the target slot's exams
  const initialKey = `${currDate}_${currSlotIdx}`;
  if (bucketMap.has(initialKey)) {
    queue.push(...bucketMap.get(initialKey)!);
    bucketMap.delete(initialKey); // Clear from bucketMap since they are now in the queue
  }

  let safetyCounter = 0;
  // While we have exams to schedule or there are still populated future buckets in bucketMap
  while ((queue.length > 0 || bucketMap.size > 0) && safetyCounter++ < 500) {
    if (queue.length === 0) {
      // Find the next chronologically earliest bucket in bucketMap that has exams
      const keys = Array.from(bucketMap.keys()).sort((a, b) => {
        const [dateA, slotA] = a.split("_");
        const [dateB, slotB] = b.split("_");
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return Number(slotA) - Number(slotB);
      });
      
      if (keys.length === 0) break; // No more exams to schedule anywhere!
      
      const nextKey = keys[0];
      const [nextDate, nextSlotStr] = nextKey.split("_");
      currDate = nextDate;
      currSlotIdx = Number(nextSlotStr);
      
      queue.push(...bucketMap.get(nextKey)!);
      bucketMap.delete(nextKey);
    }

    const currentSlotLimits = VALID_SLOTS[currSlotIdx];
    const slotStartMin = currentSlotLimits.startMinutes;
    const slotEndMin = currentSlotLimits.endMinutes;

    // We schedule as many elements from the queue into (currDate, currSlotIdx) as possible
    let currentMinutes = slotStartMin;

    while (queue.length > 0) {
      const exam = queue[0];
      
      // If it fits in the current remaining slot space:
      if (currentMinutes + exam.duration <= slotEndMin) {
        // Place it!
        const finalStart = currentMinutes;
        const finalEnd = finalStart + exam.duration;
        
        updatedExams.push({
          ...exam,
          date: currDate,
          startTime: minutesToTime(finalStart),
          endTime: minutesToTime(finalEnd),
        });
        
        queue.shift(); // Remove from queue
        currentMinutes = finalEnd + bufferMinutes; // Advance currentMinutes by duration and buffer
      } else {
        // It does NOT fit here.
        // Wait, what if the slot is completely empty (currentMinutes === slotStartMin)
        // and the exam duration is larger than the entire slot capacity?
        // We have no choice but to let it start at slotStartMin and overflow, removing it from queue,
        // and then advance.
        if (currentMinutes === slotStartMin) {
          const finalStart = slotStartMin;
          const finalEnd = finalStart + exam.duration;
          
          updatedExams.push({
            ...exam,
            date: currDate,
            startTime: minutesToTime(finalStart),
            endTime: minutesToTime(finalEnd % 1440),
          });
          
          queue.shift();
          // Advance to next slot right away
        }
        
        // Break from placement loop to advance to the next slot module
        break;
      }
    }

    // Advance to next session/module:
    currSlotIdx++;
    if (currSlotIdx >= 3) {
      currSlotIdx = 0;
      currDate = getNextDay(currDate);
    }

    // Pull in pre-existing exams from newly advanced session (if any) and append to queue
    const advancedKey = `${currDate}_${currSlotIdx}`;
    if (bucketMap.has(advancedKey)) {
      queue.push(...bucketMap.get(advancedKey)!);
      bucketMap.delete(advancedKey);
    }
  }

  // Before returning, update all exams' durations according to their assigned times
  const finalExams = updatedExams.map((e) => {
    const startM = timeToMinutes(e.startTime);
    let endM = timeToMinutes(e.endTime);
    if (endM < startM) endM += 1440;
    return {
      ...e,
      duration: endM - startM,
    };
  });

  return [...untouchedExams, ...finalExams];
}


