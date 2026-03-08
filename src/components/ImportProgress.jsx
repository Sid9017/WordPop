import { useState, useEffect, useSyncExternalStore } from "react";
import { saveWord } from "../lib/api";

let _task = null;
let _abort = false;
const _listeners = new Set();

function notify() {
  for (const fn of _listeners) fn();
}

function getSnapshot() {
  return _task;
}

function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function startGlobalImport(words, onComplete) {
  _abort = false;
  _task = { total: words.length, done: 0, failed: 0, active: true };
  notify();

  (async () => {
    let done = 0;
    let failed = 0;
    const BATCH = 3;

    for (let i = 0; i < words.length; i += BATCH) {
      if (_abort) break;
      const batch = words.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((w) =>
          saveWord({
            word: w.word,
            ukPhonetic: w.ukPhonetic || "",
            usPhonetic: w.usPhonetic || "",
            phonetic: w.usPhonetic || w.ukPhonetic || "",
            imageUrl: "",
            meanings: w.meanings || [],
          })
        )
      );
      for (const r of results) {
        if (r.status === "fulfilled") done++;
        else failed++;
      }
      _task = { total: words.length, done, failed, active: true };
      notify();
    }

    _task = { ..._task, done, failed, active: false };
    notify();
    if (onComplete) onComplete();
  })();
}

export function cancelGlobalImport() {
  _abort = true;
  if (_task) {
    _task = { ..._task, active: false };
    notify();
  }
}

export function clearGlobalImport() {
  _task = null;
  notify();
}

export function useGlobalImportTask() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export default function ImportProgress() {
  const task = useGlobalImportTask();
  if (!task) return null;

  const pct = task.total > 0 ? Math.round((task.done / task.total) * 100) : 0;

  return (
    <div className={`import-progress ${task.active ? "" : "import-done"}`}>
      <div className="import-progress-bar">
        <div className="import-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="import-progress-info">
        {task.active ? (
          <>
            <span>正在导入 {task.done}/{task.total}...</span>
            <button className="import-cancel-btn" onClick={cancelGlobalImport}>取消</button>
          </>
        ) : (
          <>
            <span>
              导入完成：成功 {task.done}{task.failed > 0 ? `，失败 ${task.failed}` : ""}
            </span>
            <button className="import-dismiss-btn" onClick={clearGlobalImport}>关闭</button>
          </>
        )}
      </div>
    </div>
  );
}
