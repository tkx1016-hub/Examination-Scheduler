/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Teacher, Exam, VALID_SLOTS } from "../types";
import { timeToMinutes, minutesToTime } from "../utils/scheduler";
import { AlertCircle, PlusCircle, Check, Info } from "lucide-react";

interface ManualExamFormProps {
  teachers: Teacher[];
  onAddExam: (exam: Omit<Exam, "id">) => void;
}

export const ManualExamForm: React.FC<ManualExamFormProps> = ({ teachers, onAddExam }) => {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [subject, setSubject] = useState("");
  const [selectedInvigilators, setSelectedInvigilators] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeTeachers = teachers.filter((t) => t.active);

  const handleInvigilatorToggle = (teacherId: string) => {
    setSelectedInvigilators((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
    );
  };

  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!date) {
      setErrorMessage("请选择考试日期");
      return;
    }
    if (!subject.trim()) {
      setErrorMessage("请输入考试科目名称");
      return;
    }

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    if (startMin >= endMin) {
      setErrorMessage("考试开始时间必须早于结束时间");
      return;
    }

    // Verify time fits strictly within one of the valid slots
    // 07:30 - 12:15, 14:00 - 18:00, 19:00 - 22:00
    const matchedSlot = VALID_SLOTS.find(
      (slot) => startMin >= slot.startMinutes && endMin <= slot.endMinutes
    );

    if (!matchedSlot) {
      setErrorMessage(
        "考试时间必须在以下规定时段内，不能跨时段且不可超出边界：\n" +
          "• 上午：07:30 - 12:15\n" +
          "• 下午：14:00 - 18:00\n" +
          "• 晚上：19:00 - 22:00"
      );
      return;
    }

    const duration = endMin - startMin;

    onAddExam({
      date,
      startTime,
      endTime,
      subject: subject.trim(),
      duration,
      invigilators: selectedInvigilators,
    });

    setSuccessMessage(`手动安排成功: ${subject} (${startTime}-${endTime})`);
    setSubject("");
    setSelectedInvigilators([]);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  return (
    <div id="manual-exam-form" className="bg-white rounded-xl border border-gray-100 p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">手动安排单场考试 (Manual Schedule)</h2>
        <p className="text-xs text-gray-500">手动录入指定日期、科目的考试，并自由指定监考教师。</p>
      </div>

      {/* Info constraints note */}
      <div className="mb-5 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3.5 text-xs text-indigo-700 flex gap-2.5">
        <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block mb-0.5">严格时间段限制：</span>
          <p>
            您的考试时间只能在 <strong>07:30-12:15</strong>、<strong>14:00-18:00</strong> 
            以及 <strong>19:00-22:00</strong> 范围内安排。系统会自动进行合规性校验。
          </p>
        </div>
      </div>

      <form onSubmit={validateAndSubmit} className="space-y-4">
        {/* Date and Subject */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">考试日期</label>
            <input
              id="manual-input-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-50/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">科目名称</label>
            <input
              id="manual-input-subject"
              type="text"
              placeholder="例如: 语文、高等数学、计算机系统"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-400 bg-gray-50/50"
            />
          </div>
        </div>

        {/* Start Time and End Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">开始时间</label>
            <input
              id="manual-input-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-50/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">结束时间</label>
            <input
              id="manual-input-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-50/50"
            />
          </div>
        </div>

        {/* Invigilators assignment section */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            分配监考教师 (可多选)
          </label>
          {activeTeachers.length === 0 ? (
            <p className="text-xs text-red-500 italic p-3 border border-red-100 rounded-lg bg-red-50/30">
              当前暂无激活中的教师！请先在教师管理板块添加/激活教师。
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50/50">
              {activeTeachers.map((teacher) => {
                const isSelected = selectedInvigilators.includes(teacher.id);
                return (
                  <button
                    key={teacher.id}
                    id={`btn-manual-select-teacher-${teacher.id}`}
                    type="button"
                    onClick={() => handleInvigilatorToggle(teacher.id)}
                    className={`px-3 py-1.5 text-xs text-left rounded-md border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span>{teacher.name}</span>
                    {isSelected && <Check size={12} className="text-indigo-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-lg whitespace-pre-line flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 rounded-lg flex items-center gap-2">
            <Check size={16} className="shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Add Button */}
        <button
          id="btn-manual-submit"
          type="submit"
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-900 border border-transparent rounded-lg text-sm font-semibold text-white shadow-xs hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <PlusCircle size={16} />
          加入考试日程安排
        </button>
      </form>
    </div>
  );
};
