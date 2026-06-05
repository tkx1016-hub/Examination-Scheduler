/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Teacher, Exam } from "../types";
import { UserCheck, UserX, Plus, Trash2, Edit2, Check, X, ShieldAlert, Clock } from "lucide-react";

interface TeacherManagerProps {
  teachers: Teacher[];
  exams: Exam[];
  onAddTeacher: (name: string) => void;
  onToggleTeacherActive: (id: string) => void;
  onDeleteTeacher: (id: string) => void;
  onUpdateTeacherName: (id: string, newName: string) => void;
  onClearDuties: () => void;
}

export const TeacherManager: React.FC<TeacherManagerProps> = ({
  teachers,
  exams,
  onAddTeacher,
  onToggleTeacherActive,
  onDeleteTeacher,
  onUpdateTeacherName,
  onClearDuties,
}) => {
  const [newTeacherName, setNewTeacherName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;
    onAddTeacher(newTeacherName.trim());
    setNewTeacherName("");
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const saveEdit = (id: string) => {
    if (editingName.trim()) {
      onUpdateTeacherName(id, editingName.trim());
    }
    setEditingId(null);
  };

  // Find max duties for visual proportion sizing
  const maxDuties = Math.max(...teachers.map((t) => t.dutyCount), 1);

  return (
    <div id="teacher-manager-container" className="bg-white rounded-xl border border-gray-100 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">监考教师管理 (Invigilators)</h2>
          <p className="text-xs text-gray-500">添加监考教师，设置是否参与监考，并查看已被分配的监考次数及累计监考总时长。</p>
        </div>
        <button
          id="btn-clear-duties"
          onClick={onClearDuties}
          className="self-start text-xs font-semibold px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1"
        >
          <ShieldAlert size={14} />
          重置所有监考次数
        </button>
      </div>

      {/* Add Teacher Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          id="input-teacher-name"
          type="text"
          placeholder="输入教师姓名 (如: 黎老师)..."
          value={newTeacherName}
          onChange={(e) => setNewTeacherName(e.target.value)}
          className="flex-1 px-3.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-400 bg-gray-50/50"
        />
        <button
          id="btn-add-teacher"
          type="submit"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-xs hover:shadow-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 flex items-center gap-1.5 transition-all"
        >
          <Plus size={16} />
          添加
        </button>
      </form>

      {/* Global Activity Summary Board */}
      <div className="mb-6 bg-gray-50/50 border border-gray-150 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-3xs">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            📊 监考勤务统计汇总
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            自动统计当前所有参与排程的教师监考人次负载和累计总时间。
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono self-stretch sm:self-auto justify-end">
          <div className="bg-white px-4 py-2 border border-gray-150 rounded-lg text-center min-w-[100px]">
            <span className="text-[10px] text-gray-400 block font-semibold leading-none mb-1">总监考场次</span>
            <span className="text-base font-black text-indigo-600">
              {teachers.reduce((s, t) => s + t.dutyCount, 0)} <span className="text-[10px] font-normal text-gray-500">人次</span>
            </span>
          </div>
          <div className="bg-white px-4 py-2 border border-gray-150 rounded-lg text-center min-w-[110px]">
            <span className="text-[10px] text-gray-400 block font-semibold leading-none mb-1">累计总时长</span>
            <span className="text-base font-black text-indigo-600">
              {teachers.reduce((sum, t) => {
                const teacherExams = exams.filter((e) => e.invigilators.includes(t.id));
                return sum + teacherExams.reduce((s, e) => s + e.duration, 0);
              }, 0)} <span className="text-[10px] font-normal text-gray-500">分钟</span>
            </span>
          </div>
        </div>
      </div>

      {/* Teacher List */}
      {teachers.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
          暂无教师数据。请在上方输入姓名添加教师。
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {teachers.map((teacher) => {
            const dutyPercentage = Math.round((teacher.dutyCount / maxDuties) * 100);
            
            // Calculate total proctoring minutes for this teacher
            const teacherExams = exams.filter((e) => e.invigilators.includes(teacher.id));
            const totalMinutes = teacherExams.reduce((sum, e) => sum + e.duration, 0);

            return (
              <div
                key={teacher.id}
                id={`teacher-row-${teacher.id}`}
                className={`p-3.5 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  teacher.active
                    ? "bg-white border-gray-200 hover:border-indigo-100"
                    : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                {/* Info and Edit Name */}
                <div className="flex items-center gap-3 min-w-[180px]">
                  <button
                    id={`btn-toggle-active-${teacher.id}`}
                    type="button"
                    onClick={() => onToggleTeacherActive(teacher.id)}
                    title={teacher.active ? "点击设置为不参与监考" : "点击设置为参与监考"}
                    className={`p-2 rounded-lg transition-colors ${
                      teacher.active
                        ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {teacher.active ? <UserCheck size={16} /> : <UserX size={16} />}
                  </button>

                  <div className="flex-1">
                    {editingId === teacher.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          id={`input-edit-name-${teacher.id}`}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="px-2 py-0.5 text-sm border border-indigo-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 rounded-sm w-32"
                          autoFocus
                        />
                        <button
                          id={`btn-save-edit-${teacher.id}`}
                          title="确认"
                          onClick={() => saveEdit(teacher.id)}
                          className="p-1 bg-emerald-50 text-emerald-600 rounded-sm hover:bg-emerald-100"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          id={`btn-cancel-edit-${teacher.id}`}
                          title="取消"
                          onClick={() => setEditingId(null)}
                          className="p-1 bg-gray-50 text-gray-500 rounded-sm hover:bg-gray-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/name">
                        <span className={`text-sm font-medium ${teacher.active ? "text-gray-900" : "text-gray-500 line-through"}`}>
                          {teacher.name}
                        </span>
                        <button
                          id={`btn-edit-name-${teacher.id}`}
                          title="修改名称"
                          onClick={() => startEdit(teacher.id, teacher.name)}
                          className="text-gray-400 hover:text-indigo-600 opacity-0 group-hover/name:opacity-100 transition-opacity"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">
                      {teacher.active ? "参与监考" : "请假/暂不分配"}
                    </p>
                  </div>
                </div>

                {/* Duty statistics progress bar */}
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="text-xs text-gray-500 font-medium whitespace-nowrap min-w-[140px]">
                    <div>
                      已编排: <span className="text-indigo-600 font-bold">{teacher.dutyCount}</span> 场次
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-0.5">
                      <Clock size={11} />
                      监考总时长: <span className="font-extrabold">{totalMinutes}</span> 分钟
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden max-w-[200px]" title={`负载比例: ${dutyPercentage}%`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        teacher.dutyCount === 0 
                          ? "bg-gray-300" 
                          : teacher.dutyCount > maxDuties * 0.8
                          ? "bg-amber-500"
                          : "bg-indigo-600"
                      }`}
                      style={{ width: `${Math.max(dutyPercentage, 3)}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <button
                  id={`btn-delete-teacher-${teacher.id}`}
                  onClick={() => onDeleteTeacher(teacher.id)}
                  title="删除该教师"
                  className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors self-end md:self-auto"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
