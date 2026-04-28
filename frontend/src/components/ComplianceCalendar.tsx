import React from 'react';

export default function ComplianceCalendar() {
const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();
const deadlines = [
{
date: new Date(currentYear, currentMonth, 7),
type: 'TDS Payment',
desc: 'TDS Payment Due',
color: 'red'
},
{
date: new Date(currentYear, currentMonth, 10),
type: 'GST Filing',
desc: 'GST Return Filing (GSTR-1)',
color: 'orange'
},
{
date: new Date(currentYear, currentMonth, 13),
type: 'GST Payment',
desc: 'GST Payment (GSTR-3B)',
color: 'yellow'
},
{
date: new Date(currentYear, currentMonth, 15),
type: 'PF/ESI',
desc: 'PF & ESI Payment',
color: 'blue'
},
{
date: new Date(currentYear, currentMonth + 1, 7),
type: 'TDS Payment',
desc: 'TDS Payment Due (Next)',
color: 'red'
}
].sort((a, b) => a.date.getTime() - b.date.getTime());
const getColorClasses = (color: string) => {
const colors: Record<string, { bg: string; border: string; text: string }> = {
red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }
};
return colors[color] || colors.yellow;
};
return (
<div className="bg-white p-6 rounded-lg border border-gray-200">
<h3 className="text-lg font-semibold mb-6">📅 Compliance Calendar - Upcoming Deadlines</h3>
  <div className="space-y-3">
    {deadlines.map((deadline, idx) => {
      const daysUntil = Math.ceil((deadline.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isUrgent = daysUntil <= 7 && daysUntil > 0;
      const isDue = daysUntil <= 0;
      const colors = getColorClasses(deadline.color);

      return (
        <div
          key={idx}
          className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border}`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className={`font-semibold ${colors.text}`}>{deadline.desc}</p>
              <p className="text-sm text-gray-600 mt-1">
                {deadline.date.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div className="text-right">
              {isDue ? (
                <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${colors.text}`}>
                  ⚠️ OVERDUE
                </span>
              ) : isUrgent ? (
                <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${colors.text}`}>
                  ⏰ {daysUntil} days left
                </span>
              ) : (
                <span className="text-gray-600 text-sm">📌 {daysUntil} days</span>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>

  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <p className="text-sm text-blue-900">
      <span className="font-semibold">💡 Tip:</span> Automate your compliance reminders by setting notifications for these dates.
    </p>
  </div>
</div>
);
}