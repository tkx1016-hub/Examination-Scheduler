/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Teacher, SubjectInput, VALID_SLOTS } from "../types";
import { autoScheduleExams, SchedulerConfig } from "../utils/scheduler";
import { Plus, Trash2, Zap, RotateCcw, HelpCircle, Calendar, Users, Sliders, Play } from "lucide-react";

interface AutoSchedulerProps {
  teachers: Teacher[];
  subjects: SubjectInput[];
  setSubjects: React.Dispatch<React.SetStateAction<SubjectInput[]>>;
  onSchedulingComplete: (newExams: any[], updatedTeachers: Teacher[]) => void;
}

const PRESET_SUBJECTS: Omit<SubjectInput, "id">[] = [
  { name: "中國語文 （一）", duration: 90 },
  { name: "中國語文 （二）", duration: 135 },
  { name: "英國語文 （一）", duration: 90 },
  { name: "英國語文 （二）", duration: 120 },
  { name: "英國語文 （三）", duration: 135 },
  { name: "数学（一）", duration: 135 },
  { name: "数学（二）", duration: 75 },
  { name: "公民與社會發展", duration: 120 },
  { name: "化学（一）", duration: 150 },
  { name: "化学（二）", duration: 60 },
  { name: "生物（一）", duration: 150 },
  { name: "生物（二）", duration: 60 },
  { name: "历史（一）", duration: 120 },
  { name: "历史（二）", duration: 90 },
  { name: "经济（一）", duration: 60 },
  { name: "经济（二）", duration: 150 },
];

export const AutoScheduler: React.FC<AutoSchedulerProps> = ({ 
  teachers, 
  subjects, 
  setSubjects, 
  onSchedulingComplete 
}) => {
  const [inputName, setInputName] = useState("");
  const [inputDuration, setInputDuration] = useState<number>(120);

  // Scheduling Configurations
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    // Default to +3 days from today
    today.setDate(today.getDate() + 3);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [teachersPerExam, setTeachersPerExam] = useState<number>(2);
  const [bufferMinutes, setBufferMinutes] = useState<number>(30);
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true);
  const [clearExistingDuties, setClearExistingDuties] = useState<boolean>(true);
  const [warning, setWarning] = useState<string | null>(null);

  const activeTeachersCount = teachers.filter((t) => t.active).length;

  const handleAddSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputName.trim()) return;
    if (inputDuration <= 0) return;

    setSubjects((prev) => [
      ...prev,
      {
        id: `subject-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: inputName.trim(),
        duration: Number(inputDuration),
      },
    ]);
    setInputName("");
  };

  const handleDeleteSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const loadPresets = () => {
    const freshSubjects = PRESET_SUBJECTS.map((p, idx) => ({
      id: `preset-${idx}-${Date.now()}`,
      name: p.name,
      duration: p.duration,
    }));
    setSubjects(freshSubjects);
  };

  const clearAllSubjects = () => {
    setSubjects([]);
  };

  const handleUpdateSubjectName = (id: string, name: string) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  };

  const handleUpdateSubjectDuration = (id: string, duration: number) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, duration: Math.max(1, duration) } : s))
    );
  };

  const handleRunScheduler = () => {
    setWarning(null);

    if (subjects.length === 0) {
      setWarning("请至少添加一个待考科目进行安排！");
      return;
    }

    if (activeTeachersCount === 0) {
      setWarning("当前没有可分配的监考教师！请确保教师列表里有且勾选了参与的教师！");
      return;
    }

    if (activeTeachersCount < teachersPerExam) {
      setWarning(
        `您设置了每场考试需要 ${teachersPerExam} 名监考教师，但目前仅有 ${activeTeachersCount} 名可用教师。分配数量已调整至上限。`
      );
    }

    if (endDate && endDate.trim() !== "") {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      sDate.setHours(0,0,0,0);
      eDate.setHours(0,0,0,0);
      if (eDate < sDate) {
        setWarning("排期结束日期不能早于开始日期！");
        return;
      }
    }

    // Run packing algorithm
    const config: SchedulerConfig = {
      startDate,
      endDate: endDate || undefined,
      teachersPerExam,
      bufferMinutes,
      skipWeekends,
      clearExistingDuties,
    };

    const result = autoScheduleExams(subjects, teachers, config);
    onSchedulingComplete(result.exams, result.updatedTeachers);
  };

  return (
    <div id="auto-scheduler-container" className="bg-white rounded-xl border border-gray-100 p-6 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Subjects management section - Left Panel (7 Cols) */}
      <div className="lg:col-span-7 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="text-amber-500 fill-amber-100" size={18} />
                自动排考与监考 (Auto-Schedule)
              </h2>
              <p className="text-xs text-gray-500">
                录入一批待考科目和对应分钟时长。系统将顺序拟合拼合到限制时间窗口内并按负载平衡策略安排教师。
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                id="btn-load-presets"
                onClick={loadPresets}
                title="加载高考科目预设"
                className="text-xs font-semibold px-2.5 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors"
              >
                导入经典预设
              </button>
              <button
                id="btn-clear-subjects"
                onClick={clearAllSubjects}
                title="清空科目列表"
                className="p-1.5 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-500 border border-gray-200 rounded-md transition-colors"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Quick Subject Add Form */}
          <form onSubmit={handleAddSubject} className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-gray-55/40 border border-gray-100 rounded-lg">
            <div className="flex-1">
              <input
                id="auto-subject-name"
                type="text"
                placeholder="科目名称 (如: 物理、英语听力)"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>
            <div className="w-full sm:w-40 flex items-center gap-1.5">
              <input
                id="auto-subject-duration"
                type="number"
                min={1}
                max={400}
                placeholder="考试时长"
                value={inputDuration}
                onChange={(e) => setInputDuration(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-500 bg-white text-right"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">分钟</span>
            </div>
            <button
              id="btn-add-subject-to-list"
              type="submit"
              className="px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-md border border-indigo-200 shrink-0 transition-colors"
            >
              <Plus size={14} className="inline mr-0.5" />
              追加
            </button>
          </form>

          {/* Table of current subjects to schedule */}
          <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto mb-4">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-500 uppercase border-b border-gray-100 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">序列</th>
                  <th className="px-4 py-2.5">待考科目</th>
                  <th className="px-4 py-2.5 text-right">考试时长</th>
                  <th className="px-4 py-2.5 text-center w-16">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-450 text-xs italic">
                      列队暂空！请添加考试科目，或者点击上方“导入经典预设”
                    </td>
                  </tr>
                ) : (
                  subjects.map((sub, index) => (
                    <tr key={sub.id} className="hover:bg-gray-50/50 group/subrow">
                      <td className="px-4 py-2.5 text-gray-400 font-mono">{index + 1}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => handleUpdateSubjectName(sub.id, e.target.value)}
                          className="w-full px-2 py-1 text-xs font-semibold text-gray-900 bg-transparent hover:bg-gray-100/75 focus:bg-white focus:ring-1 focus:ring-indigo-150 border border-transparent focus:border-indigo-305 rounded-md focus:outline-hidden transition-all"
                          title="点击可直接修改科目名称"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-indigo-650 font-semibold">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={400}
                            value={sub.duration}
                            onChange={(e) => handleUpdateSubjectDuration(sub.id, Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-transparent hover:border-gray-200 focus:border-indigo-305 focus:ring-1 focus:ring-indigo-150 rounded-md text-xs font-mono text-indigo-650 text-right focus:outline-hidden bg-transparent focus:bg-white transition-all"
                            title="点击可直接修改考试时长"
                          />
                          <span className="text-gray-400 font-sans text-xs">分</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          id={`btn-del-subject-${sub.id}`}
                          onClick={() => handleDeleteSubject(sub.id)}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic validation note */}
        <div className="text-[11px] leading-relaxed text-gray-450 bg-gray-50 border border-gray-100 rounded-lg p-2.5 flex items-start gap-1.5">
          <HelpCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
          <span>
            系统将在每日指定的限制段内对科目进行最优容纳拼合。若配置了<b>排期结束日期</b>，系统会根据开始和结束日期，将考试科目<b>均匀地分布在每一天</b>进行排程，避免单日科目过度堆叠。
          </span>
        </div>
      </div>

      {/* Scheduler controller parameters - Right Panel (5 Cols) */}
      <div className="lg:col-span-5 bg-gray-50/50 border border-gray-100 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-1.5">
            <Sliders size={16} className="text-indigo-600" />
            排程参数配置
          </h3>

          <div className="space-y-4">
            {/* Start and End Date selection in grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1.5">
                  <Calendar size={13} className="text-gray-450" />
                  排期开始日期
                </label>
                <input
                  id="auto-config-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-hidden bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1.5">
                  <Calendar size={13} className="text-gray-450" />
                  排期结束日期
                </label>
                <input
                  id="auto-config-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-hidden bg-white"
                />
              </div>
            </div>

            {/* Proctors per Room */}
            <div>
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                <Users size={13} className="text-gray-450" />
                每场考试所需监考教师
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="auto-config-teachers-per-exam"
                  type="range"
                  min={1}
                  max={4}
                  value={teachersPerExam}
                  onChange={(e) => setTeachersPerExam(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-sm whitespace-nowrap">
                  {teachersPerExam} 人 / 场
                </span>
              </div>
            </div>

            {/* Buffer time */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                考试间歇休息缓冲时间 (分钟)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="auto-config-buffer"
                  type="range"
                  min={0}
                  max={120}
                  step={10}
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-sm whitespace-nowrap">
                  {bufferMinutes} 分钟
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                同个时间段段内(如早上)安排多科时的排考间距。
              </p>
            </div>

            {/* Checkbox Options */}
            <div className="space-y-2 border-t border-gray-100 pt-3.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                <input
                  id="auto-config-skip-weekends"
                  type="checkbox"
                  checked={skipWeekends}
                  onChange={(e) => setSkipWeekends(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded-sm border-gray-300 focus:ring-indigo-500"
                />
                <span>自动跳过周六与周日</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                <input
                  id="auto-config-clear-duties"
                  type="checkbox"
                  checked={clearExistingDuties}
                  onChange={(e) => setClearExistingDuties(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded-sm border-gray-300 focus:ring-indigo-500"
                />
                <span>排程前先将所有教师负荷计数归零</span>
              </label>
            </div>
          </div>
        </div>

        {/* Run Button is locked at bottom */}
        <div className="mt-6">
          {warning && (
            <div className="p-3 mb-3 bg-amber-50 border border-amber-100 text-[11px] text-amber-700 rounded-md">
              {warning}
            </div>
          )}

          <button
            id="btn-trigger-auto-scheduling"
            onClick={handleRunScheduler}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-lg shadow-xs hover:shadow-md hover:transform active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play size={14} className="fill-white" />
            生成智能排考及监考表
          </button>
        </div>
      </div>
    </div>
  );
};
