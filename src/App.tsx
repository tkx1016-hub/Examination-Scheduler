/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { Teacher, Exam } from "./types";
import { TeacherManager } from "./components/TeacherManager";
import { ManualExamForm } from "./components/ManualExamForm";
import { AutoScheduler } from "./components/AutoScheduler";
import { TimetableDisplay } from "./components/TimetableDisplay";
import { cascadeShiftExams, timeToMinutes, minutesToTime, cascadeShiftWithSlots } from "./utils/scheduler";
import { 
  Calendar, 
  Users, 
  Zap, 
  PlusCircle, 
  BookOpen, 
  Clock, 
  Sparkles, 
  GraduationCap, 
  FileSpreadsheet, 
  HelpCircle,
  HelpCircle as QuestionIcon,
  Trash2
} from "lucide-react";

const INITIAL_TEACHERS: Teacher[] = [
  { id: "teacher-1", name: "杨庭栋", active: true, dutyCount: 0 },
  { id: "teacher-2", name: "杨焕春", active: true, dutyCount: 0 },
  { id: "teacher-3", name: "宁世玉", active: true, dutyCount: 0 },
  { id: "teacher-4", name: "夏小丹", active: true, dutyCount: 0 },
  { id: "teacher-5", name: "唐晓蕾", active: true, dutyCount: 0 },
  { id: "teacher-6", name: "徐丽华", active: true, dutyCount: 0 },
  { id: "teacher-7", name: "王清旭", active: true, dutyCount: 0 },
  { id: "teacher-8", name: "陈伟", active: true, dutyCount: 0 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"timetable" | "auto" | "teachers" | "manual">("timetable");

  // Reusable custom confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    primaryText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void, primaryText: string = "确认") => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
      primaryText,
    });
  };

  // Load from local storage or defaults
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_teachers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Automatically migrate if using older layout templates or need "陈伟" preset
        if (Array.isArray(parsed)) {
          const names = parsed.map(t => t.name);
          const needsMigration = parsed.some(t => t.name.includes("张老师")) || 
            (parsed.length === 7 && names.includes("杨庭栋") && !names.includes("陈伟"));
          if (needsMigration) {
            return INITIAL_TEACHERS;
          }
        }
        return parsed;
      } catch (e) {
        console.error("Failed parsing saved teachers, using defaults.");
      }
    }
    return INITIAL_TEACHERS;
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_exams");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed parsing saved exams.");
      }
    }
    return [];
  });

  const [subjects, setSubjects] = useState<any[]>(() => {
    const saved = localStorage.getItem("exam_scheduler_subjects");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed parsing saved subjects.");
      }
    }
    return [
      { id: "sub-1", name: "中國語文 （一）", duration: 90 },
      { id: "sub-2", name: "中國語文 （二）", duration: 135 },
      { id: "sub-3", name: "英國語文 （一）", duration: 90 },
      { id: "sub-4", name: "英國語文 （二）", duration: 120 },
    ];
  });

  // Persist states to local storage
  useEffect(() => {
    localStorage.setItem("exam_scheduler_teachers", JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_exams", JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem("exam_scheduler_subjects", JSON.stringify(subjects));
  }, [subjects]);

  // Derived state: calculate teachers' duty counts dynamically to ensure perfect synchronization
  const computedTeachers = useMemo(() => {
    return teachers.map((t) => ({
      ...t,
      dutyCount: exams.filter((e) => e.invigilators.includes(t.id)).length,
    }));
  }, [teachers, exams]);

  // Handle addition of a single teacher
  const handleAddTeacher = (name: string) => {
    const newTeacher: Teacher = {
      id: `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      active: true,
      dutyCount: 0,
    };
    setTeachers((prev) => [...prev, newTeacher]);
  };

  // Toggle active/inactive for teacher eligibility
  const handleToggleTeacherActive = (id: string) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t))
    );
  };

  // Delete a teacher
  const handleDeleteTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    // Also remove them from exams or keep ID as placeholder?
    // In TimetableDisplay, we handle deleted/missing teachers gracefully.
  };

  // Update teacher's display name
  const handleUpdateTeacherName = (id: string, newName: string) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: newName } : t))
    );
  };

  // Reset all duties count to 0
  const handleClearDuties = () => {
    showConfirm(
      "全员清零负荷确认",
      "确定要将所有教师的监考负荷计数清零吗？这不会删除排考日程。",
      () => {
        setTeachers((prev) => prev.map((t) => ({ ...t, dutyCount: 0 })));
      },
      "开始清零"
    );
  };

  // Add manually scheduled exam
  const handleAddExam = (examData: Omit<Exam, "id">) => {
    const newExam: Exam = {
      ...examData,
      id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setExams((prev) => [...prev, newExam]);

    // Update dutyCount in real state to match the new schedule
    setTeachers((prev) =>
      prev.map((t) => {
        const hasDuty = examData.invigilators.includes(t.id);
        return {
          ...t,
          dutyCount: t.dutyCount + (hasDuty ? 1 : 0),
        };
      })
    );
  };

  // Delete an individual exam
  const handleDeleteExam = (id: string) => {
    const targetExam = exams.find((e) => e.id === id);
    if (!targetExam) return;

    setExams((prev) => prev.filter((e) => e.id !== id));

    // Deduct proctors' dutyCount
    setTeachers((prev) =>
      prev.map((t) => {
        const hadDuty = targetExam.invigilators.includes(t.id);
        return {
          ...t,
          dutyCount: Math.max(0, t.dutyCount - (hadDuty ? 1 : 0)),
        };
      })
    );
  };

  // Inline adjustment / edit of invigilations for a scheduled exam
  const handleUpdateExamInvigilators = (examId: string, teacherIds: string[]) => {
    setExams((prevExams) => prevExams.map((e) => (e.id === examId ? { ...e, invigilators: teacherIds } : e)));

    // Re-sync teachers' dutyCounts to match
    setTeachers((prevTeachers) =>
      prevTeachers.map((t) => {
        const updatedExams = exams.map((e) => (e.id === examId ? { ...e, invigilators: teacherIds } : e));
        return {
          ...t,
          dutyCount: updatedExams.filter((e) => e.invigilators.includes(t.id)).length,
        };
      })
    );
  };

  // Update starting time and ending time of an exam, automatically cascade shifting subsequent exams
  const handleUpdateExamTime = (examId: string, newDate: string, newStartTime: string, newEndTime: string) => {
    setExams((prevExams) => cascadeShiftExams(prevExams, examId, newDate, newStartTime, newEndTime, 15));
  };

  // Move an exam to a specific date and time slot with automatic module-cascade overflow shifts
  const handleUpdateExamToSlot = (examId: string, targetDate: string, targetSlotIdx: number) => {
    setExams((prevExams) => cascadeShiftWithSlots(prevExams, examId, targetDate, targetSlotIdx, 15));
  };

  // Bulk align all exams on all days to be tight with 15 minutes buffer
  const handleAutoAlignAllExams = () => {
    if (exams.length === 0) return;

    showConfirm(
      "自动对齐与避让确认",
      "确定要一键自动紧凑排齐所有日期的考试场次吗？这会为同日、同半天的科目自动预留 15 分钟间隔并消除任何重叠。",
      () => {
        setExams((prevExams) => {
          // Group by date
          const grouped: { [date: string]: Exam[] } = {};
          prevExams.forEach((e) => {
            if (!grouped[e.date]) grouped[e.date] = [];
            grouped[e.date].push(e);
          });

          const updatedExams: Exam[] = [];

          Object.keys(grouped).forEach((date) => {
            const dayExams = [...grouped[date]].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            
            // Separate morning and afternoon/evening (split at 13:00)
            const morningExams = dayExams.filter((e) => timeToMinutes(e.startTime) < 13 * 60);
            const afternoonExams = dayExams.filter((e) => timeToMinutes(e.startTime) >= 13 * 60);

            // Align morning
            if (morningExams.length > 0) {
              let prevEndMin = timeToMinutes(morningExams[0].startTime) + morningExams[0].duration;
              morningExams[0] = {
                ...morningExams[0],
                endTime: minutesToTime(prevEndMin % 1440),
              };

              for (let i = 1; i < morningExams.length; i++) {
                const startMin = prevEndMin + 15; // 15 mins buffer
                prevEndMin = startMin + morningExams[i].duration;
                morningExams[i] = {
                  ...morningExams[i],
                  startTime: minutesToTime(startMin % 1440),
                  endTime: minutesToTime(prevEndMin % 1440),
                };
              }
            }

            // Align afternoon
            if (afternoonExams.length > 0) {
              let prevEndMin = timeToMinutes(afternoonExams[0].startTime) + afternoonExams[0].duration;
              afternoonExams[0] = {
                ...afternoonExams[0],
                endTime: minutesToTime(prevEndMin % 1440),
              };

              for (let i = 1; i < afternoonExams.length; i++) {
                const startMin = prevEndMin + 15; // 15 mins buffer
                prevEndMin = startMin + afternoonExams[i].duration;
                afternoonExams[i] = {
                  ...afternoonExams[i],
                  startTime: minutesToTime(startMin % 1440),
                  endTime: minutesToTime(prevEndMin % 1440),
                };
              }
            }

            updatedExams.push(...morningExams, ...afternoonExams);
          });

          // Keep user's correct duty counts as well
          setTeachers((prevTeachers) =>
            prevTeachers.map((t) => ({
              ...t,
              dutyCount: updatedExams.filter((e) => e.invigilators.includes(t.id)).length,
            }))
          );

          return updatedExams;
        });
      },
      "自动排齐"
    );
  };

  // Erase all exams
  const handleClearAllExams = () => {
    showConfirm(
      "清空日程时间表确认",
      "确定清除当前整张考试时间表和监考安排吗？这也会还原所有教师的排班计数，此操作不可撤销！",
      () => {
        setExams([]);
        setTeachers((prev) => prev.map((t) => ({ ...t, dutyCount: 0 })));
      },
      "彻底清空"
    );
  };

  // Global Wipe: Clears registered scheduled exams grid, resets proctor load counters, and clears subject list for rescheduling
  const handleGlobalClearAll = () => {
    showConfirm(
      "一键全清排程重设确认",
      "确定要一键清空当此监考排程的所有科目并重新设置吗？\n\n此操作将同时：\n1. 清空当前时间表中的所有科目日程安排\n2. 清空自动排程中的待排科目队列\n3. 重置所有教师的累计监考场次和时长计数",
      () => {
        setExams([]);
        setSubjects([]);
        setTeachers((prev) => prev.map((t) => ({ ...t, dutyCount: 0 })));
      },
      "一键重置"
    );
  };

  // Handle output from AutoScheduler
  const handleSchedulingComplete = (newExams: Exam[], updatedTeachers: Teacher[]) => {
    setExams((prev) => {
      // If we cleared stats during scheduling, overwrite exams. Otherwise, append.
      // The auto-scheduler clearExistingDuties resets the updatedTeachers stats from 0 inside the tool.
      // So let's overwrite with new exams, or merge if they decided not to clear.
      const shouldClearAll = updatedTeachers.some(t => t.dutyCount < (teachers.find(o => o.id === t.id)?.dutyCount || 0));
      return shouldClearAll ? newExams : [...prev, ...newExams];
    });
    setTeachers(updatedTeachers);
    setActiveTab("timetable"); // Redirect automatically to the calendar view to check results!
  };

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 selection:bg-indigo-100 selection:text-indigo-950 font-sans antialiased">
      {/* Upper Elegant Header Bar */}
      <header className="bg-white border-b border-gray-150 sticky top-0 z-40 print:relative print:border-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-1.5">
                考务监考智能编排系统
                <span className="text-[10px] text-indigo-700 bg-indigo-50 font-semibold px-2 py-0.5 rounded-full border border-indigo-100/50 print:hidden">
                  在线智能版
                </span>
              </h1>
              <p className="text-xs text-gray-500">
                支持手动及一键多科目贪婪拟合排考，严格适配 7:30-12:15、14:00-18:00、19:00-22:00 时段约束
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 print:hidden shrink-0">
            <button
              id="btn-global-clear-all"
              onClick={handleGlobalClearAll}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-150 text-red-600 hover:text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-3xs cursor-pointer"
            >
              <Trash2 size={13} />
              🧹 一键清空当前排考日程
            </button>
            <div className="flex items-center gap-4 text-xs font-mono text-gray-400 shrink-0 bg-gray-50 border border-gray-100 px-3.5 py-1.5 rounded-lg">
              <span>当前时间段设定: 严格 7:30~12:15 | 14:00~18:00 | 19:00~22:00</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Help box */}
        <div className="mb-6 bg-white border border-gray-150 rounded-xl p-5 flex flex-col md:flex-row items-start gap-4 shadow-2xs print:hidden">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-950 mb-1.5 flex items-center gap-1">⚡ 智能排考黄金步骤 (经典编排逻辑)</h3>
            <p className="text-xs text-indigo-950/70 leading-relaxed space-y-1">
              • <b>第一步：导入预算/手动追加</b> — 开排前，您可在 <b>“🧹 一键清空”</b> 后进入 <b>“⚡ 智能自动排程”</b> 里“导入经典预设”或“手动追加单场科目”。<br />
              • <b>第二步：一键开启自动排考</b> — 确认待排科目正确后，一键点击<b>“开始自动排考”</b>，系统即可利用贪婪拟合无缝拼排时段并均衡轮配师资。<br />
              • <b>第三步：自由拖拽微调时段</b> — 返回 <b>“📅 监考时间日程表”</b> 切换至<b>“拖拽日程表”</b>模式，用鼠标随意拖动科目拼块，余下科目及老师会自动自适应顺延！<br />
              • <b>第四步：自动统计并导出 Excel</b> — 在 <b>“👩‍🏫 教师名录”</b> 里统计工作负荷（计算监考总时长与总场次），一键点击右上角<b>“导出 Excel”</b>精美汇总表！
            </p>
          </div>
        </div>

        {/* Tab Workspace Selectors */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200 overflow-x-auto pb-px print:hidden scrollbar-none">
          <button
            id="tab-btn-timetable"
            onClick={() => setActiveTab("timetable")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "timetable"
                ? "border-indigo-600 text-indigo-700 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Calendar size={16} />
            📅 监考时间表日程 ({exams.length})
          </button>

          <button
            id="tab-btn-auto"
            onClick={() => setActiveTab("auto")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "auto"
                ? "border-indigo-600 text-indigo-700 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Zap size={16} />
            ⚡ 智能自动排程
          </button>

          <button
            id="tab-btn-teachers"
            onClick={() => setActiveTab("teachers")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "teachers"
                ? "border-indigo-600 text-indigo-700 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Users size={16} />
            👩‍🏫 监考师资名录 ({teachers.length})
          </button>

          <button
            id="tab-btn-manual"
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "manual"
                ? "border-indigo-600 text-indigo-700 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <PlusCircle size={16} />
            ✍️ 手动加排单场
          </button>
        </div>

        {/* Workspace views rendered conditionally based on selection */}
        <div className="space-y-6">
          {activeTab === "timetable" && (
            <div id="view-timetable-wrapper">
              <TimetableDisplay
                exams={exams}
                teachers={computedTeachers}
                onDeleteExam={handleDeleteExam}
                onUpdateExamInvigilators={handleUpdateExamInvigilators}
                onUpdateExamTime={handleUpdateExamTime}
                onUpdateExamToSlot={handleUpdateExamToSlot}
                onClearAllExams={handleClearAllExams}
                onAutoAlignAllExams={handleAutoAlignAllExams}
              />
            </div>
          )}

          {activeTab === "auto" && (
            <div id="view-auto-wrapper">
              <AutoScheduler
                teachers={computedTeachers}
                subjects={subjects}
                setSubjects={setSubjects}
                onSchedulingComplete={handleSchedulingComplete}
              />
            </div>
          )}

          {activeTab === "teachers" && (
            <div id="view-teachers-wrapper">
              <TeacherManager
                teachers={computedTeachers}
                exams={exams}
                onAddTeacher={handleAddTeacher}
                onToggleTeacherActive={handleToggleTeacherActive}
                onDeleteTeacher={handleDeleteTeacher}
                onUpdateTeacherName={handleUpdateTeacherName}
                onClearDuties={handleClearDuties}
              />
            </div>
          )}

          {activeTab === "manual" && (
            <div id="view-manual-wrapper">
              <ManualExamForm 
                teachers={computedTeachers} 
                onAddExam={handleAddExam} 
              />
            </div>
          )}
        </div>
      </main>

      {/* Simple, Professional, Clean footer */}
      <footer className="mt-16 bg-white border-t border-gray-150 py-8 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            考务监考智能编排 system © 2026. Made with high precision logic.
          </p>
          <div className="flex gap-4 text-[11px] text-gray-400">
            <span>支持自适应排考</span>
            <span>•</span>
            <span>严格遵守时间限制 (07:30~12:15, 14:00~18:00, 19:00~22:00)</span>
          </div>
        </div>
      </footer>

      {/* Custom unblocked high contrast modal confirmation */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-gray-905 bg-opacity-65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-950 flex items-center gap-2 mb-2">
              <span className="p-1 text-red-600 bg-red-50 rounded-lg">
                <Trash2 size={15} />
              </span>
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-150 text-gray-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                id="btn-confirm-dialog-primary"
                onClick={confirmDialog.onConfirm}
                className="px-3.5 py-1.5 bg-red-650 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {confirmDialog.primaryText || "确定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
