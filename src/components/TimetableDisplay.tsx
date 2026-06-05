/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Exam, Teacher, VALID_SLOTS } from "../types";
import { Search, Calendar, Trash2, Printer, Download, Clock, BookOpen, User, Grid, List, Check, X, Edit2, FileSpreadsheet, Sparkles } from "lucide-react";
import { timeToMinutes, minutesToTime, getSlotIndex } from "../utils/scheduler";

interface TimetableDisplayProps {
  exams: Exam[];
  teachers: Teacher[];
  onDeleteExam: (id: string) => void;
  onUpdateExamInvigilators: (examId: string, teacherIds: string[]) => void;
  onUpdateExamTime: (examId: string, newDate: string, newStartTime: string, newEndTime: string) => void;
  onUpdateExamToSlot?: (examId: string, targetDate: string, targetSlotIdx: number) => void;
  onClearAllExams: () => void;
  onAutoAlignAllExams?: () => void;
}

export const TimetableDisplay: React.FC<TimetableDisplayProps> = ({
  exams,
  teachers,
  onDeleteExam,
  onUpdateExamInvigilators,
  onUpdateExamTime,
  onUpdateExamToSlot,
  onClearAllExams,
  onAutoAlignAllExams,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat" | "timeline">("grouped");
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [tempInvigilators, setTempInvigilators] = useState<string[]>([]);

  // State for editing timing (date, start time, end time)
  const [editingTimingExamId, setEditingTimingExamId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState("");
  const [tempStartTime, setTempStartTime] = useState("");
  const [tempEndTime, setTempEndTime] = useState("");

  // Drag and drop states for timeline rescheduling
  const [draggingExamId, setDraggingExamId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, examId: string) => {
    setDraggingExamId(examId);
    e.dataTransfer.setData("text/plain", examId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingExamId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = (e: React.DragEvent, date: string, targetTimeStr: string) => {
    e.preventDefault();
    e.stopPropagation(); // Avoid triggering parent container drops
    const examId = e.dataTransfer.getData("text/plain") || draggingExamId;
    if (!examId) return;

    const targetExam = exams.find((exam) => exam.id === examId);
    if (!targetExam) return;

    // Calculate new end time based on original duration
    const [h, m] = targetTimeStr.split(":").map(Number);
    const endTotalMin = h * 60 + m + targetExam.duration;
    const calcHours = Math.floor((endTotalMin % 1440) / 60);
    const calcMins = endTotalMin % 60;
    const calculatedEndTime = `${String(calcHours).padStart(2, "0")}:${String(calcMins).padStart(2, "0")}`;

    onUpdateExamTime(examId, date, targetTimeStr, calculatedEndTime);
    setDraggingExamId(null);
  };

  const handleDropOnSlotBlock = (e: React.DragEvent, date: string, slotIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const examId = e.dataTransfer.getData("text/plain") || draggingExamId;
    if (!examId) return;

    if (onUpdateExamToSlot) {
      onUpdateExamToSlot(examId, date, slotIdx);
    } else {
      // Fallback
      const standardStarts = ["07:30", "14:00", "19:00"];
      onUpdateExamTime(examId, date, standardStarts[slotIdx], "22:00");
    }
    setDraggingExamId(null);
  };

  const handleDropOnDayHeader = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    const examId = e.dataTransfer.getData("text/plain") || draggingExamId;
    if (!examId) return;

    const targetExam = exams.find((exam) => exam.id === examId);
    if (!targetExam) return;

    // Shift to target date and automatically append to the end of that day with 15-minute buffer!
    const targetDayExams = exams
      .filter((e) => e.date === targetDate && e.id !== examId)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    let newStart = targetExam.startTime;
    let newEnd = targetExam.endTime;

    if (targetDayExams.length > 0) {
      // There are exams on this day. Find the latest end-time of exams on that day
      const lastExam = targetDayExams[targetDayExams.length - 1];
      const lastEndMin = timeToMinutes(lastExam.endTime);
      
      const newStartMin = lastEndMin + 15; // 15-min buffer
      const newEndMin = newStartMin + targetExam.duration;

      newStart = minutesToTime(newStartMin % 1440);
      newEnd = minutesToTime(newEndMin % 1440);
    } else {
      // Empty day. Default start based on original shift, or standard session starting times
      const origStartMin = timeToMinutes(targetExam.startTime);
      if (origStartMin < 13 * 60) {
        newStart = "08:15"; // standard morning start
      } else if (origStartMin < 18.5 * 60) {
        newStart = "14:10"; // standard afternoon start
      } else {
        newStart = "19:00"; // standard evening start
      }
      const newStartMin = timeToMinutes(newStart);
      newEnd = minutesToTime((newStartMin + targetExam.duration) % 1440);
    }

    onUpdateExamTime(examId, targetDate, newStart, newEnd);
    setDraggingExamId(null);
  };

  const handleDropOnExamCard = (e: React.DragEvent, targetExam: Exam) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubble so it doesn't trigger the day container drop!
    const examId = e.dataTransfer.getData("text/plain") || draggingExamId;
    if (!examId || examId === targetExam.id) return;

    const draggedExam = exams.find((e) => e.id === examId);
    if (!draggedExam) return;

    // We want the dragged exam to take the targetExam's startTime & date
    const targetDate = targetExam.date;
    const targetStart = targetExam.startTime;
    
    // Calculate new end time for dragged exam based on targetStart and its own duration
    const startMin = timeToMinutes(targetStart);
    const endMin = startMin + draggedExam.duration;
    const targetEnd = minutesToTime(endMin % 1440);

    // Update time of dragged exam! This will automatically trigger `cascadeShiftExams` 
    // which places the dragged exam at targetStart and shifts all exams starting AFTER it!
    onUpdateExamTime(examId, targetDate, targetStart, targetEnd);
    setDraggingExamId(null);
  };

  // Build a teacher lookup map for quick access
  const teacherMap = useMemo(() => {
    return new Map(teachers.map((t) => [t.id, t]));
  }, [teachers]);

  // Generate list of consecutive dates (current exams dates range + 5 trailing days) for drag-and-drop rescheduling across days
  const scheduleDates = useMemo(() => {
    if (exams.length === 0) return [];
    
    const dateStrings = exams.map((e) => e.date);
    const sortedDates = [...dateStrings].sort();
    const earliestStr = sortedDates[0];
    const latestStr = sortedDates[sortedDates.length - 1];
    
    const earliestDate = new Date(earliestStr);
    const latestDate = new Date(latestStr);
    
    // Add 5 extra dates at the tail to allow dragging/dropping into future blank days
    const endDate = new Date(latestDate);
    endDate.setDate(endDate.getDate() + 5);
    
    const list: string[] = [];
    const temp = new Date(earliestDate);
    // Safety guard to avoid any runaway loop
    let safetyCounter = 0;
    while (temp <= endDate && safetyCounter < 150) {
      safetyCounter++;
      const year = temp.getFullYear();
      const month = String(temp.getMonth() + 1).padStart(2, "0");
      const day = String(temp.getDate()).padStart(2, "0");
      list.push(`${year}-${month}-${day}`);
      temp.setDate(temp.getDate() + 1);
    }
    return list;
  }, [exams]);

  // Filter exams based on Search query
  const filteredExams = useMemo(() => {
    if (!searchQuery.trim()) return exams;
    const query = searchQuery.toLowerCase().trim();
    return exams.filter((exam) => {
      const subjectMatch = exam.subject.toLowerCase().includes(query);
      const dateMatch = exam.date.includes(query);
      const teacherMatch = exam.invigilators.some((tid) => {
        const teacher = teacherMap.get(tid);
        return teacher ? teacher.name.toLowerCase().includes(query) : false;
      });
      return subjectMatch || dateMatch || teacherMatch;
    });
  }, [exams, searchQuery, teacherMap]);

  // Group exams by Date for the Grouped view
  const groupedExams = useMemo(() => {
    const groups: { [date: string]: Exam[] } = {};
    // Sort chronologically
    const sorted = [...filteredExams].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    sorted.forEach((exam) => {
      if (!groups[exam.date]) {
        groups[exam.date] = [];
      }
      groups[exam.date].push(exam);
    });
    return groups;
  }, [filteredExams]);

  // Identify which daily slot an exam belongs to
  const getSlotColorAndName = (startTime: string, endTime: string) => {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    // Morning: 07:30 - 12:15
    if (startMin >= 7 * 60 + 30 && endMin <= 12 * 60 + 15) {
      return {
        label: "上午场 (Morning)",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
        borderClass: "border-l-4 border-l-emerald-500",
      };
    }
    // Afternoon: 14:00 - 18:00
    if (startMin >= 14 * 60 && endMin <= 18 * 60) {
      return {
        label: "下午场 (Afternoon)",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-100",
        borderClass: "border-l-4 border-l-indigo-500",
      };
    }
    // Evening: 19:00 - 22:00
    if (startMin >= 19 * 60 && endMin <= 22 * 60) {
      return {
        label: "晚上场 (Evening)",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
        borderClass: "border-l-4 border-l-amber-500",
      };
    }

    return {
      label: "自定义时段 (Custom)",
      badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
      borderClass: "border-l-4 border-l-gray-400",
    };
  };

  // Trigger browser print
  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn("打印触发异常: ", e);
      window.print();
    }
  };

  // Convert timetable to XLSX excel format in the exact matrix design requested and trigger download
  const handleExportExcel = () => {
    if (exams.length === 0) return;

    // 1. Get unique sorted dates
    const uniqueDates = Array.from(new Set<string>(exams.map((e) => e.date))).sort();

    // 2. Determine max exams scheduled on any single day to define columns
    const maxExamsPerDay = Math.max(
      ...uniqueDates.map((d) => exams.filter((e) => e.date === d).length),
      1
    );

    // 3. Construct Array of Arrays (AoA) representing the spreadsheet content
    const aoa: any[][] = [];

    // Header row
    const headerRow = ["日期/星期", "信息项目"];
    for (let i = 1; i <= maxExamsPerDay; i++) {
      headerRow.push(`场次 ${i}`);
    }
    headerRow.push("空闲/无监考教师");
    aoa.push(headerRow);

    const merges: any[] = [];
    let currentExcelRow = 1; // Row 0 is the Header

    const getChineseDateStr = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        const weekday = weekdays[date.getDay()];
        return `${year}年${month}月${day}日\n${weekday}`;
      } catch {
        return dateStr;
      }
    };

    // 4. Fill matrix blocks day by day
    for (const date of uniqueDates) {
      const examsForDate = exams
        .filter((e) => e.date === date)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      // Calculate unassigned active teachers
      const assignedTeacherIds = new Set(examsForDate.flatMap((e) => e.invigilators));
      const unassignedTeachersList = teachers
        .filter((t) => t.active && !assignedTeacherIds.has(t.id))
        .map((t) => t.name)
        .join("、");

      const dateStr = getChineseDateStr(date);

      // Row A: 科目
      const subjectRow = [dateStr, "科目"];
      for (let i = 0; i < maxExamsPerDay; i++) {
        if (i < examsForDate.length) {
          subjectRow.push(examsForDate[i].subject);
        } else {
          subjectRow.push("");
        }
      }
      subjectRow.push(unassignedTeachersList);
      aoa.push(subjectRow);

      // Row B: 时间
      const timeRow = ["", "时间"];
      for (let i = 0; i < maxExamsPerDay; i++) {
        if (i < examsForDate.length) {
          timeRow.push(`${examsForDate[i].startTime}-${examsForDate[i].endTime}`);
        } else {
          timeRow.push("");
        }
      }
      timeRow.push("");
      aoa.push(timeRow);

      // Row C: 监考
      const proctorRow = ["", "监考"];
      for (let i = 0; i < maxExamsPerDay; i++) {
        if (i < examsForDate.length) {
          const names = examsForDate[i].invigilators
            .map((tid) => teacherMap.get(tid)?.name || "未知")
            .join("、");
          proctorRow.push(names || "未安排");
        } else {
          proctorRow.push("");
        }
      }
      proctorRow.push("");
      aoa.push(proctorRow);

      // Add merged ranges (0-indexed)
      const startR = currentExcelRow;
      const endR = currentExcelRow + 2;

      // Merge Date column across 3 rows
      merges.push({ s: { r: startR, c: 0 }, e: { r: endR, c: 0 } });

      // Merge Unassigned Teachers column across 3 rows
      merges.push({ s: { r: startR, c: 2 + maxExamsPerDay }, e: { r: endR, c: 2 + maxExamsPerDay } });

      currentExcelRow += 3;
    }

    // 5. Build worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Apply merges
    worksheet["!merges"] = merges;

    // Apply column widths
    const cols = [
      { wch: 22 }, // Date
      { wch: 10 }, // Type ("科目", "时间", "监考")
    ];
    for (let i = 0; i < maxExamsPerDay; i++) {
      cols.push({ wch: 22 }); // Exam slots
    }
    cols.push({ wch: 32 }); // Unassigned teachers column
    worksheet["!cols"] = cols;

    // Apply row heights (Header is row 0)
    const rowHeights = [{ hpt: 26 }];
    for (let i = 1; i < currentExcelRow; i++) {
      rowHeights.push({ hpt: 22 });
    }
    worksheet["!rows"] = rowHeights;

    // 6. Write file
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "考务监考编排表");

    XLSX.writeFile(
      workbook,
      `学校考务监考编排表_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Edit proctors inline helpers
  const handleStartEdit = (exam: Exam) => {
    setEditingExamId(exam.id);
    setTempInvigilators([...exam.invigilators]);
  };

  const handleToggleTempInvigilator = (tid: string) => {
    setTempInvigilators((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid]
    );
  };

  const handleSaveInvigilatorEdit = (examId: string) => {
    onUpdateExamInvigilators(examId, tempInvigilators);
    setEditingExamId(null);
  };

  return (
    <div id="timetable-display-card" className="bg-white rounded-xl border border-gray-100 p-6 shadow-xs print:border-none print:shadow-none print:p-0">
      {/* Header operations bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5 mb-5 print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">当前排考及监考教师时间表</h2>
          <p className="text-xs text-gray-500">
            总计已排: <span className="text-indigo-600 font-bold">{exams.length}</span> 场次。可拖拽调整，支持直接导出为 Excel 表格。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle tabs */}
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            <button
              id="tab-view-grouped"
              onClick={() => setViewMode("grouped")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "grouped" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Grid size={13} />
              日期分组
            </button>
            <button
              id="tab-view-flat"
              onClick={() => setViewMode("flat")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "flat" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <List size={13} />
              完整列表
            </button>
            <button
              id="tab-view-timeline"
              onClick={() => setViewMode("timeline")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === "timeline" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Calendar size={13} className="text-indigo-600" />
              拖拽排程 (新)
            </button>
          </div>

          <button
            id="btn-print-timetable"
            onClick={handlePrint}
            disabled={exams.length === 0}
            className="p-2 border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            打印视图
          </button>

          <button
            id="btn-export-timetable"
            onClick={handleExportExcel}
            disabled={exams.length === 0}
            className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold text-xs hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-605" />
            导出 Excel (XLSX)
          </button>

          {onAutoAlignAllExams && (
            <button
              id="btn-auto-align-timetable"
              onClick={onAutoAlignAllExams}
              disabled={exams.length === 0}
              className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold text-xs hover:bg-indigo-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer animate-pulse-subtle"
              title="自动紧凑排齐科目时间段并自动预留 15 分钟的间隔，消除任何冲突和重叠"
            >
              <Sparkles size={14} className="text-indigo-650" />
              ✨ 自动紧凑排齐
            </button>
          )}

          <button
            id="btn-clear-timetable"
            onClick={onClearAllExams}
            disabled={exams.length === 0}
            className="p-2 bg-red-50 text-red-600 font-semibold text-xs hover:bg-red-100 border border-red-100 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
          >
            清空日程
          </button>
        </div>
      </div>

      {/* Filter search bar */}
      <div className="mb-6 relative max-w-sm print:hidden">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
          <Search size={14} />
        </span>
        <input
          id="input-timetable-search"
          type="text"
          placeholder="搜索日期、科目或教师名称..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg bg-gray-50/50"
        />
      </div>

      {/* Primary timetable container */}
      {exams.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-150 rounded-xl bg-gray-50/30">
          <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-450">当前还没有安排任何考试</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            您可以通过下方的<b>“手动安排”</b>或<b>“智能自动排考”</b>模块一键生成日程。
          </p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-xs">没有匹配到相关的考试日程</div>
      ) : viewMode === "grouped" ? (
        /* ================= GROUPED VIEW ================= */
        <div className="space-y-6">
          {Object.keys(groupedExams).sort().map((date) => (
            <div key={date} id={`exam-group-${date}`} className="break-inside-avoid">
              {/* Group Date Header */}
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnDayHeader(e, date)}
                className={`flex items-center justify-between gap-2 mb-3 border-b pb-1.5 transition-all rounded px-2 py-1 ${
                  draggingExamId 
                    ? "bg-indigo-50/50 border-dashed border-indigo-300 ring-2 ring-indigo-200 cursor-pointer animate-pulse-subtle" 
                    : "border-gray-100"
                }`}
                title={draggingExamId ? "拖放到此处，即可将科目排到该日期（自动接续到该日最晚科目后）" : undefined}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-indigo-600" />
                  <span className="text-sm font-bold text-gray-900 font-mono">{date}</span>
                  <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                    {new Date(date).toLocaleDateString("zh-CN", { weekday: "long" })}
                  </span>
                </div>
                {draggingExamId && (
                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded-md">
                    📥 拖放跨天
                  </span>
                )}
              </div>

              {/* Grid of exam sessions of this day */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedExams[date].map((exam) => {
                  const slotMeta = getSlotColorAndName(exam.startTime, exam.endTime);
                  const isEditing = editingExamId === exam.id;
                  const isDragged = draggingExamId === exam.id;
                  const isOtherDragged = draggingExamId && draggingExamId !== exam.id;

                  return (
                    <div
                      key={exam.id}
                      id={`exam-card-${exam.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, exam.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnExamCard(e, exam)}
                      className={`bg-white rounded-lg border p-4 relative group hover:shadow-xs transition-all flex flex-col justify-between cursor-grab active:cursor-grabbing ${
                        isDragged 
                          ? "border-dashed border-indigo-400 opacity-40 bg-indigo-50/20 scale-95" 
                          : isOtherDragged
                          ? "border-dashed border-indigo-300 bg-indigo-50/5 ring-2 ring-indigo-200/50 hover:border-indigo-500 hover:bg-indigo-50/20"
                          : `border-gray-150 ${slotMeta.borderClass}`
                      }`}
                      title={isOtherDragged ? "拖放到此处即可在此科目之前插入本场考试并自动对齐" : "可按住卡片并拖拽。放至其他考试上可交换位置，或向各日期标题拖拽进行跨天快速安排"}
                    >
                      <div>
                        {/* Tags and Delete button (hidden in print) */}
                        <div className="flex justify-between items-center gap-1.5 mb-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${slotMeta.badgeClass}`}>
                            {slotMeta.label}
                          </span>
                          <button
                            id={`btn-delete-exam-${exam.id}`}
                            onClick={() => onDeleteExam(exam.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md transition-all shrink-0 print:hidden"
                            title="删除此场排考"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Subject name */}
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-2">
                          <BookOpen size={14} className="text-gray-400" />
                          {exam.subject}
                        </h4>

                        {/* Timing info */}
                        {editingTimingExamId === exam.id ? (
                          <div className="text-xs text-gray-700 space-y-2 mb-3 bg-indigo-50/40 p-2 border border-indigo-150 rounded-md font-sans">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 mb-0.5">考试日期:</label>
                              <input
                                type="date"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                className="w-full text-xs px-2 py-1 bg-white border border-gray-200 rounded font-mono"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-0.5">开始时间:</label>
                                <input
                                  type="time"
                                  value={tempStartTime}
                                  onChange={(e) => {
                                    const newStartTime = e.target.value;
                                    setTempStartTime(newStartTime);
                                    if (newStartTime && exam.duration) {
                                      const startMin = timeToMinutes(newStartTime);
                                      const endMin = (startMin + exam.duration) % 1440;
                                      setTempEndTime(minutesToTime(endMin));
                                    }
                                  }}
                                  className="w-full text-xs px-1.5 py-1 bg-white border border-gray-200 rounded font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-0.5">结束时间:</label>
                                <input
                                  type="time"
                                  value={tempEndTime}
                                  onChange={(e) => setTempEndTime(e.target.value)}
                                  className="w-full text-xs px-1.5 py-1 bg-white border border-gray-200 rounded font-mono"
                                />
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-550 font-mono bg-white p-1 rounded border border-gray-100 flex justify-between">
                              <span>新考试时长:</span>
                              <span className="font-bold text-indigo-700">
                                {(() => {
                                  if (!tempStartTime || !tempEndTime) return "--";
                                  const [h1, m1] = tempStartTime.split(":").map(Number);
                                  const [h2, m2] = tempEndTime.split(":").map(Number);
                                  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                                  if (diff < 0) diff += 1440;
                                  return `${diff} 分钟`;
                                })()}
                              </span>
                            </div>
                            <div className="flex justify-end gap-1 pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateExamTime(exam.id, tempDate, tempStartTime, tempEndTime);
                                  setEditingTimingExamId(null);
                                }}
                                className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                              >
                                确定
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTimingExamId(null)}
                                className="text-[10px] px-2 py-0.5 bg-gray-150 text-gray-600 rounded hover:bg-gray-200 cursor-pointer"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-600 space-y-1 mb-3 bg-gray-50/50 p-1.5 rounded-md border border-gray-100 font-mono">
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-gray-400 shrink-0" />
                              <span>
                                {exam.startTime} ~ {exam.endTime}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 pl-4">
                              <span>时长: {exam.duration} 分钟</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTimingExamId(exam.id);
                                  setTempDate(exam.date);
                                  setTempStartTime(exam.startTime);
                                  setTempEndTime(exam.endTime);
                                }}
                                className="text-[10px] text-indigo-600 hover:underline print:hidden cursor-pointer font-sans font-semibold"
                              >
                                手调时间
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Proctor section */}
                      <div className="border-t border-gray-100 pt-2.5 mt-2 text-xs">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="text-[10px] font-semibold text-indigo-700">重新调整监考教师:</div>
                            <div className="max-h-24 overflow-y-auto border border-gray-200 rounded-md p-1.5 bg-white space-y-1">
                              {teachers.filter(t => t.active).map((t) => {
                                const activeAssigned = tempInvigilators.includes(t.id);
                                return (
                                  <button
                                    key={t.id}
                                    id={`btn-edit-assign-${exam.id}-${t.id}`}
                                    type="button"
                                    onClick={() => handleToggleTempInvigilator(t.id)}
                                    className={`w-full text-left px-2 py-1 text-[10px] rounded flex justify-between items-center transition-colors ${
                                      activeAssigned ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-50 text-gray-600"
                                    }`}
                                  >
                                    <span>{t.name}</span>
                                    {activeAssigned && <Check size={10} />}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                id={`btn-save-assign-${exam.id}`}
                                onClick={() => handleSaveInvigilatorEdit(exam.id)}
                                className="text-[10px] font-bold px-2 py-0.5 bg-indigo-650 text-white rounded-md hover:bg-indigo-700 cursor-pointer"
                              >
                                确定
                              </button>
                              <button
                                id={`btn-cancel-assign-${exam.id}`}
                                onClick={() => setEditingExamId(null)}
                                className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-650 rounded-md hover:bg-gray-200 cursor-pointer"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-gray-400 font-medium">监考教师 / Proctors:</span>
                            <button
                              id={`btn-start-edit-exam-invigilators-${exam.id}`}
                              onClick={() => handleStartEdit(exam)}
                              className="text-[10px] text-indigo-600 hover:underline print:hidden cursor-pointer"
                            >
                              手调教师
                            </button>
                          </div>
                        )}

                        {!isEditing && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {exam.invigilators.length === 0 ? (
                              <span className="text-[11px] text-red-500 italic font-medium bg-red-50 px-1.5 py-0.5 rounded-sm">
                                🚨 未安排
                              </span>
                            ) : (
                              exam.invigilators.map((tid) => {
                                const teacher = teacherMap.get(tid);
                                return (
                                  <span
                                    key={tid}
                                    className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-sm font-medium text-[11px] border border-indigo-100/50 inline-flex items-center gap-0.5"
                                  >
                                    <User size={10} />
                                    {teacher ? teacher.name : `已删教师(ID:${tid})`}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "flat" ? (
        /* ================= FLAT TABLE VIEW ================= */
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-150">
              <tr>
                <th className="px-4 py-3">考试日期</th>
                <th className="px-4 py-3">时间范围</th>
                <th className="px-4 py-3">科目</th>
                <th className="px-4 py-3 text-right">时间长度</th>
                <th className="px-4 py-3">监考教师</th>
                <th className="px-4 py-3 text-center w-16 print:hidden">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {[...filteredExams]
                .sort((a, b) => {
                  if (a.date !== b.date) return a.date.localeCompare(b.date);
                  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
                })
                .map((exam) => {
                  return (
                    <tr key={exam.id} id={`exam-row-${exam.id}`} className="hover:bg-gray-50/50 font-mono">
                      {editingTimingExamId === exam.id ? (
                        <>
                          <td className="px-4 py-2.5">
                            <input
                              type="date"
                              value={tempDate}
                              onChange={(e) => setTempDate(e.target.value)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded font-mono w-32 bg-white"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-indigo-750 font-semibold">
                            <div className="flex flex-col gap-1.5 w-40">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-gray-450 w-6 shrink-0">起:</span>
                                <input
                                  type="time"
                                  value={tempStartTime}
                                  onChange={(e) => {
                                    const newStartTime = e.target.value;
                                    setTempStartTime(newStartTime);
                                    if (newStartTime && exam.duration) {
                                      const startMin = timeToMinutes(newStartTime);
                                      const endMin = (startMin + exam.duration) % 1440;
                                      setTempEndTime(minutesToTime(endMin));
                                    }
                                  }}
                                  className="px-1.5 py-0.5 text-xs border border-gray-300 rounded font-mono w-24 bg-white"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-gray-450 w-6 shrink-0">止:</span>
                                <input
                                  type="time"
                                  value={tempEndTime}
                                  onChange={(e) => setTempEndTime(e.target.value)}
                                  className="px-1.5 py-0.5 text-xs border border-gray-300 rounded font-mono w-24 bg-white"
                                />
                              </div>
                              <span className="text-[9px] text-gray-400 font-sans">
                                新时长: {(() => {
                                  if (!tempStartTime || !tempEndTime) return "--";
                                  const [h1, m1] = tempStartTime.split(":").map(Number);
                                  const [h2, m2] = tempEndTime.split(":").map(Number);
                                  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                                  if (diff < 0) diff += 1440;
                                  return `${diff}分钟`;
                                })()}
                              </span>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-bold text-gray-900">{exam.date}</td>
                          <td className="px-4 py-2.5 text-indigo-700 font-semibold group/timecell">
                            <div className="flex items-center gap-1.5">
                              <span>{exam.startTime} ~ {exam.endTime}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTimingExamId(exam.id);
                                  setTempDate(exam.date);
                                  setTempStartTime(exam.startTime);
                                  setTempEndTime(exam.endTime);
                                }}
                                className="opacity-0 group-hover/timecell:opacity-100 p-0.5 hover:bg-indigo-50 text-indigo-600 rounded transition-opacity cursor-pointer print:hidden"
                                title="手动调整开考与结束时间"
                              >
                                <Edit2 size={11} className="inline" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2.5 font-sans font-medium text-gray-950">{exam.subject}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{exam.duration} 分钟</td>
                      <td className="px-4 py-2.5">
                        {editingExamId === exam.id ? (
                          <div className="space-y-1.5 min-w-[200px] bg-indigo-50/20 p-2 border border-indigo-150 rounded-lg">
                            <div className="text-[10px] font-bold text-indigo-700 mb-1">选择监考教师:</div>
                            <div className="max-h-24 overflow-y-auto border border-gray-200 rounded-md p-1 bg-white space-y-0.5">
                              {teachers.filter(t => t.active).map((t) => {
                                const activeAssigned = tempInvigilators.includes(t.id);
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => handleToggleTempInvigilator(t.id)}
                                    className={`w-full text-left px-1.5 py-0.5 text-[10px] rounded flex justify-between items-center transition-colors ${
                                      activeAssigned ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-gray-50 text-gray-600"
                                    }`}
                                  >
                                    <span>{t.name}</span>
                                    {activeAssigned && <Check size={10} />}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex justify-end gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleSaveInvigilatorEdit(exam.id)}
                                className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-md cursor-pointer transition-colors"
                              >
                                确定
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingExamId(null)}
                                className="text-[10px] px-2 py-0.5 bg-gray-100 hover:bg-gray-150 text-gray-600 rounded-md cursor-pointer transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group/proctorcell flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1 font-sans">
                              {exam.invigilators.length === 0 ? (
                                <span className="text-red-500 italic bg-red-50 px-1 py-0.5 rounded-sm text-[11px]">
                                  🚨 未安排
                                </span>
                              ) : (
                                exam.invigilators.map((tid) => {
                                  const t = teacherMap.get(tid);
                                  return (
                                    <span
                                      key={tid}
                                      className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-sm text-[11px] border border-indigo-100"
                                    >
                                      {t ? t.name : `已删教师(ID:${tid})`}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(exam)}
                              className="opacity-0 group-hover/proctorcell:opacity-100 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded text-[10px] hover:underline transition-all cursor-pointer font-sans print:hidden shrink-0"
                              title="手调监考教师"
                            >
                              手调教师
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center print:hidden">
                        {editingTimingExamId === exam.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateExamTime(exam.id, tempDate, tempStartTime, tempEndTime);
                                setEditingTimingExamId(null);
                              }}
                              className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              title="保存时间调整"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTimingExamId(null)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                              title="取消"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`btn-table-delete-exam-${exam.id}`}
                            onClick={() => onDeleteExam(exam.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ================= INTERACTIVE DRAG-AND-DROP TIMELINE SCHEDULER VIEW ================= */
        <div className="space-y-8 print:hidden">
          <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 inline-flex items-start gap-2.5 text-xs text-indigo-900 shadow-3xs">
            <span className="p-1 bg-indigo-650 text-white rounded font-bold shrink-0">💡</span>
            <div>
              <p className="font-bold mb-0.5 text-indigo-950">大模块智能拖拽排考看盘：</p>
              <p className="text-gray-650 leading-relaxed font-sans">
                你可以拖动任意<b>考试科目卡片</b>，<b>直接投入到下方某一日期的“上午场”、“下午场”或“晚上场”大模块中</b>。
                <br />
                📊 <b>自适应溢出顺延机制</b>：如果某个时间段内科目排得过多、或是拖入的排考导致考试时长超出当前时间段设定的边界值，<b>排考系统将全自动、智能地将该半天多余的科目后移至下一个半天的半天模块中进行顺延（支持跨天滚动溢出）</b>！
              </p>
            </div>
          </div>

          {(() => {
            const renderExamCard = (exam: Exam) => {
              const isDragged = draggingExamId === exam.id;
              const isOtherDragged = draggingExamId && draggingExamId !== exam.id;
              return (
                <div
                  key={exam.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, exam.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnExamCard(e, exam)}
                  className={`bg-white rounded-xl border p-3.5 text-xs cursor-grab active:cursor-grabbing transition-all flex flex-col justify-between shadow-3xs group/card relative ${
                    isDragged 
                      ? "border-dashed border-indigo-400 opacity-40 bg-indigo-50/20 scale-95" 
                      : isOtherDragged
                      ? "border-dashed border-indigo-300 bg-indigo-50/5 ring-2 ring-indigo-105 hover:border-indigo-500 hover:bg-indigo-50/20"
                      : "border-gray-200 bg-white hover:border-indigo-400 hover:shadow-2xs"
                  }`}
                  title={isOtherDragged ? "拖放到此处即可在此科目之前插入并自动流动对齐" : "拖动此卡片发放到其它日期或时段中进行调整"}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <span className="font-extrabold text-gray-950 truncate flex items-center gap-1">
                      <BookOpen size={12} className="text-indigo-600 shrink-0" />
                      {exam.subject}
                    </span>
                    <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded shrink-0 font-mono">
                      {exam.duration}分钟
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono mt-1 pt-2 border-t border-gray-100">
                    <span className="font-extrabold text-indigo-705 flex items-center gap-0.5 bg-indigo-50/50 px-1.5 py-0.5 rounded">
                      <Clock size={10} />
                      {exam.startTime} ~ {exam.endTime}
                    </span>
                    <span className="text-gray-400">
                      监考: {exam.invigilators.length}人
                    </span>
                  </div>
                </div>
              );
            };

            return scheduleDates.map((date) => {
              const dailyExams = groupedExams[date] || [];
              
              // Filter exams by time of day blocks
              const morningExams = dailyExams.filter(e => getSlotIndex(e.startTime) === 0)
                .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
              const afternoonExams = dailyExams.filter(e => getSlotIndex(e.startTime) === 1)
                .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
              const eveningExams = dailyExams.filter(e => getSlotIndex(e.startTime) === 2)
                .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

              return (
                <div 
                  key={date} 
                  id={`timeline-group-${date}`} 
                  className={`p-5 rounded-2xl border flex flex-col gap-5 transition-all duration-300 ${
                    draggingExamId 
                      ? "bg-indigo-50/5 border-dashed border-indigo-250 shadow-3xs" 
                      : "bg-gray-50/40 border-gray-150"
                  }`}
                >
                  {/* Header of the Day */}
                  <div className="flex items-center justify-between gap-2 border-b border-gray-150 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                        <Calendar size={15} />
                      </span>
                      <span className="text-sm font-bold text-gray-900 font-mono">{date}</span>
                      <span className="text-[10px] text-gray-450 font-bold bg-gray-150 px-2.5 py-0.5 rounded-full">
                        {new Date(date).toLocaleDateString("zh-CN", { weekday: "long" })}
                      </span>
                    </div>
                    {draggingExamId && (
                      <span className="text-[11px] text-indigo-700 font-extrabold flex items-center gap-1 animate-pulse-subtle">
                        📥 拖拽卡片投入下方任一模块：
                      </span>
                    )}
                  </div>

                  {/* Three major drop zones */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Morning Block */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnSlotBlock(e, date, 0)}
                      className={`p-4 rounded-xl border transition-all duration-300 min-h-[140px] flex flex-col ${
                        draggingExamId 
                          ? "border-emerald-400 bg-emerald-50/10 ring-2 ring-emerald-300/25 shadow-xs cursor-pointer scale-[1.01]" 
                          : "border-gray-150 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 font-mono">
                          ☀️ 上午场 (07:30 - 12:15)
                        </span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full font-mono">
                          {morningExams.length} 门
                        </span>
                      </div>
                      
                      {morningExams.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg bg-gray-50/30 py-5 text-center px-2">
                          <span className="text-[11px] text-gray-400 font-sans">
                            {draggingExamId ? "📥 释手放置到此" : "✨ 该时段无排考"}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2 flex-1">
                          {morningExams.map(renderExamCard)}
                        </div>
                      )}
                    </div>

                    {/* Afternoon Block */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnSlotBlock(e, date, 1)}
                      className={`p-4 rounded-xl border transition-all duration-300 min-h-[140px] flex flex-col ${
                        draggingExamId 
                          ? "border-indigo-400 bg-indigo-50/10 ring-2 ring-indigo-300/25 shadow-xs cursor-pointer scale-[1.01]" 
                          : "border-gray-150 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                        <span className="text-xs font-bold text-indigo-800 flex items-center gap-1 font-mono">
                          🌤️ 下午场 (14:00 - 18:00)
                        </span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full font-mono">
                          {afternoonExams.length} 门
                        </span>
                      </div>
                      
                      {afternoonExams.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg bg-gray-50/30 py-5 text-center px-2">
                          <span className="text-[11px] text-gray-400 font-sans">
                            {draggingExamId ? "📥 释手放置到此" : "✨ 该时段无排考"}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2 flex-1">
                          {afternoonExams.map(renderExamCard)}
                        </div>
                      )}
                    </div>

                    {/* Evening Block */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnSlotBlock(e, date, 2)}
                      className={`p-4 rounded-xl border transition-all duration-300 min-h-[140px] flex flex-col ${
                        draggingExamId 
                          ? "border-amber-450 bg-amber-50/10 ring-2 ring-amber-300/25 shadow-xs cursor-pointer scale-[1.01]" 
                          : "border-gray-150 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                        <span className="text-xs font-bold text-amber-800 flex items-center gap-1 font-mono">
                          🌙 晚上场 (19:00 - 22:00)
                        </span>
                        <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-full font-mono">
                          {eveningExams.length} 门
                        </span>
                      </div>
                      
                      {eveningExams.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg bg-gray-50/30 py-5 text-center px-2">
                          <span className="text-[11px] text-gray-400 font-sans">
                            {draggingExamId ? "📥 释手放置到此" : "✨ 该时段无排考"}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2 flex-1">
                          {eveningExams.map(renderExamCard)}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};
