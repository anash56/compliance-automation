

interface Deadline {
  id?: string;
  date: Date | string;
  type: string;
  desc: string;
  color: string;
  status?: string;
}

interface ComplianceCalendarProps {
  customDeadlines?: Deadline[];
  onUpdateStatus?: (id: string, newStatus: string) => void;
}

export default function ComplianceCalendar({ customDeadlines, onUpdateStatus }: ComplianceCalendarProps) {
const now = new Date();

  // Smart rolling dates for the unauthenticated homepage preview
  const getNextDate = (targetDay: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), targetDay);
    if (d.getTime() < now.getTime() - 86400000) d.setMonth(d.getMonth() + 1);
    return d;
  };

  const getNextQuarterEndDate = () => {
    const year = now.getFullYear();
    const dates = [
      new Date(year, 0, 31),
      new Date(year, 4, 31),
      new Date(year, 6, 31),
      new Date(year, 9, 31),
      new Date(year + 1, 0, 31)
    ];
    return dates.find(d => d.getTime() >= now.getTime() - 86400000) || dates[0];
  };

  const defaultDeadlines: Deadline[] = [
    { date: getNextDate(7), type: 'TDS Payment', desc: 'TDS Payment Due', color: 'red' },
    { date: getNextDate(11), type: 'GST Filing', desc: 'GSTR-1 Filing', color: 'orange' },
    { date: getNextDate(15), type: 'PF/ESI', desc: 'PF & ESI Payment', color: 'blue' },
    { date: getNextDate(20), type: 'GST Payment', desc: 'GSTR-3B Filing', color: 'yellow' },
    { date: getNextQuarterEndDate(), type: 'TDS Return', desc: 'Form 26Q Filing', color: 'purple' }
  ];

  const deadlinesList = customDeadlines !== undefined ? customDeadlines : defaultDeadlines;

  const formattedDeadlines = deadlinesList.map(d => ({
    ...d,
    date: new Date(d.date)
  })).sort((a, b) => a.date.getTime() - b.date.getTime());

const getColorClasses = (color: string) => {
const colors: Record<string, { bg: string; border: string; text: string }> = {
red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
};
return colors[color] || colors.yellow;
};

  const downloadICS = (deadline: Deadline) => {
    const startDate = new Date(deadline.date);
    startDate.setHours(9, 0, 0, 0); // Set due time to 9:00 AM
    const endDate = new Date(startDate);
    endDate.setHours(10, 0, 0, 0); // End time 10:00 AM

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ComplianceBot//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:Compliance Due: ${deadline.type}`,
      `DESCRIPTION:${deadline.desc}\\n\\nPlease ensure this is filed on time to avoid penalties.`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D', // Push notification 1 day before
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${deadline.type.replace(/\s+/g, '_')}_Reminder.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (deadlinesList.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-left">📅 Real-Time Compliance Calendar</h3>
        <div className="py-12 bg-green-50 rounded-lg border border-green-200 text-center">
          <span className="text-4xl block mb-4">🎉</span>
          <p className="text-green-800 font-bold text-xl">You are all caught up!</p>
          <p className="text-md text-green-600 mt-2">There are no pending compliance deadlines at the moment.</p>
        </div>
      </div>
    );
  }

return (
<div className="bg-white p-6 rounded-lg border border-gray-200">
<h3 className="text-lg font-semibold mb-6">📅 Real-Time Compliance Calendar</h3>
  <div className="space-y-3">
    {formattedDeadlines.map((deadline, idx) => {
      const daysUntil = Math.ceil((deadline.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isUrgent = daysUntil <= 7 && daysUntil > 0;
      const isDue = daysUntil <= 0 && deadline.status !== 'completed';
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
            <div className="text-right flex items-center justify-end gap-3">
              <div>
                {deadline.status === 'completed' ? (
                  <span className="inline-block px-3 py-1 rounded-full font-bold text-sm bg-green-100 text-green-800 border border-green-200">
                    ✅ COMPLETED
                  </span>
                ) : isDue ? (
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
                {deadline.id && onUpdateStatus && (
                  <select
                    value={deadline.status || 'pending'}
                    onChange={(e) => onUpdateStatus(deadline.id!, e.target.value)}
                    className="ml-3 text-xs font-semibold bg-gray-50 border border-gray-300 rounded px-2 py-1 cursor-pointer hover:bg-gray-100 transition"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                )}
              </div>
              {deadline.status !== 'completed' && (
                <button onClick={() => downloadICS(deadline)} className={`p-2 rounded-lg transition bg-white bg-opacity-50 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200`} title="Add to Calendar">
                  <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>
);
}