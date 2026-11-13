import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetItems, dayLabel, formatMoney, routeStops, splitNoteSections, timeline, tripLength } from "../src/tripGuideModel.js";

test("guide keeps unstructured notes and every structured section without losing paragraphs", () => {
  assert.deepEqual(splitNoteSections("普通备注\n第二行"), [{ title: "出行记录", body: "普通备注\n第二行" }]);
  const sections = splitNoteSections("开头保留\n【住宿】\n第一晚酒店。\n第二晚酒店。\n\n【核验来源】\nhttps://example.com/info\n");
  assert.deepEqual(sections.map(section => section.title), ["出行记录", "住宿", "核验来源"]);
  assert.equal(sections[1].body, "第一晚酒店。\n第二晚酒店。");
  assert.equal(sections[2].body, "https://example.com/info");
});

test("timeline preserves full original details, recognizes time ranges and keeps rain alternatives", () => {
  const entries = timeline("08:30 南京出发，带上证件。细节不能丢。\n11:30—12:15 午餐，清淡热食。\n14:00 午休。\n雨天替代：室内参观。\n无时间的补充说明");
  assert.equal(entries.length, 5);
  assert.equal(entries[0].kind, "drive");
  assert.equal(entries[0].text, "南京出发，带上证件。细节不能丢。");
  assert.equal(entries[1].time, "11:30—12:15");
  assert.equal(entries[1].kind, "meal");
  assert.equal(entries[2].kind, "rest");
  assert.equal(entries[3].kind, "rain");
  assert.equal(entries[4].text, "无时间的补充说明");
});

test("cost charts read subtotal equations without counting total or fuel-calculation numbers twice", () => {
  const items = budgetItems({ title: "预算", body: "广德住宿100 + 芜湖住宿200 = 300\n方特成人参考280 + 小童参考210 = 490\n燃油270（480公里×7.5升/百公里×7.5元/升）\n停车70\n合计1130，随实际变化。\n机动金含早餐差价。" });
  assert.deepEqual(items.map(item => item.cents), [30000, 49000, 27000, 7000]);
  assert.equal(items.reduce((sum, item) => sum + item.cents, 0), 113000);
  assert.equal(formatMoney(123456), "¥1,234.56");
  assert.equal(formatMoney(null), "未填写");
  assert.deepEqual(budgetItems(undefined), []);
  assert.deepEqual(budgetItems({ title: "预算", body: "五顿正餐140+190+180+200+160=870\n门票与景区交通200（预留）\n合计1070" }), [
    { label: "五顿正餐", cents: 87000 },
    { label: "门票与景区交通", cents: 20000 },
  ]);
});

test("route and calendar handle varying trips, leap dates and invalid dates", () => {
  assert.deepEqual(routeStops("南京 → 广德（竹海/博物馆） → 芜湖 → 南京"), ["南京", "广德", "芜湖", "南京"]);
  assert.deepEqual(routeStops("南京周末游"), ["南京周末游"]);
  assert.equal(tripLength("2026-11-13", "2026-11-15"), 3);
  assert.equal(tripLength("2024-02-28", "2024-03-01"), 3);
  assert.equal(tripLength("bad", "2026-11-15"), null);
  assert.equal(dayLabel("2026-11-13"), "11月13日周五");
});
