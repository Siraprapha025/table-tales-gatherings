import { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
const banks = [
  ["kbank", "ธนาคารกสิกรไทย", "#138f2d"],
  ["ktb", "ธนาคารกรุงไทย", "#1ba5e1"],
  ["bbl", "ธนาคารกรุงเทพ", "#1e4598"],
  ["scb", "ธนาคารไทยพาณิชย์", "#4e2e7f"],
  ["bay", "ธนาคารกรุงศรีอยุธยา", "#fec43b"],
  ["gsb", "ธนาคารออมสิน", "#eb198d"],
  ["baac", "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)", "#4b9b1d"],
  ["ghb", "ธนาคารอาคารสงเคราะห์", "#f57d23"],
  ["uob", "ธนาคารยูโอบี", "#0b3979"],
  ["tisco", "ธนาคารทิสโก้", "#12549f"],
] as const;
export function BankPicker({
  name,
  defaultValue = "",
  disabled,
  id,
  ...aria
}: {
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const known = banks.some((b) => b[1] === defaultValue);
  const [selected, setSelected] = useState(known ? defaultValue : defaultValue ? "other" : "");
  const [other, setOther] = useState(known ? "" : defaultValue);
  return (
    <div className="bank-picker">
      <Select value={selected} onValueChange={setSelected} disabled={disabled}>
        <SelectTrigger
          id={id}
          name={name}
          data-field-name={name}
          className="bank-trigger"
          {...aria}
        >
          <SelectValue placeholder="เลือกธนาคารรับเงิน" />
        </SelectTrigger>
        <SelectContent className="bank-menu">
          {banks.map(([code, label, color]) => (
            <SelectItem key={code} value={label} textValue={label}>
              <span className="bank-option">
                <img
                  src={`/banks/${code}.svg`}
                  alt=""
                  width={32}
                  height={32}
                  style={{ backgroundColor: color }}
                />
                <span>{label}</span>
              </span>
            </SelectItem>
          ))}
          <SelectItem value="other">ธนาคารอื่น / ระบุชื่อเอง</SelectItem>
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={selected === "other" ? other : selected} />
      {selected === "other" && (
        <input
          aria-label="ชื่อธนาคารอื่น"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          maxLength={100}
          disabled={disabled}
          placeholder="ระบุชื่อธนาคาร"
          aria-invalid={aria["aria-invalid"]}
          aria-describedby={aria["aria-describedby"]}
        />
      )}
    </div>
  );
}
