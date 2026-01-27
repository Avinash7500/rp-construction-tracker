import { useState } from "react";
import Button from "./Button";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import { addEngineerTask } from "../services/siteService";

const DAYS = [
  "सोमवार",
  "मंगळवार",
  "बुधवार",
  "गुरुवार",
  "शुक्रवार",
  "शनिवार",
  "रविवार",
];

function AddEngineerTaskModal({
  site,
  engineerUid,
  engineerName,
  onClose,
  onSuccess,
}) {
  const [title, setTitle] = useState("");
  const [dayName, setDayName] = useState("");
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    if (!title.trim()) {
      showError(null, "Task title required");
      return;
    }
    if (!dayName) {
      showError(null, "Please select day");
      return;
    }

    try {
      setLoading(true);

      await addEngineerTask({
        title,
        dayName,
        site,
        engineerUid,
        engineerName,
      });

      showSuccess("Task added successfully ✅");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      showError(e, "Failed to add task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
    >
      <div style={{ background: "#fff", padding: 20, borderRadius: 10, width: 320 }}>
        <h4>Add Task</h4>

        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />

        <select
          value={dayName}
          onChange={(e) => setDayName(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        >
          <option value="">Select Day</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AddEngineerTaskModal;
