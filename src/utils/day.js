import day from 'dayjs';
import 'dayjs/locale/es';
import calendar from 'dayjs/plugin/calendar';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
day.locale('es');
day.extend(utc);
day.extend(timezone);
day.tz.setDefault('America/Lima');

export function dparse(date) {
    return day(date);
}
export function getDaysPassed(date) {
    const today = day();
    return today.diff(date, 'days');
}
export function dparseFromFormat(date, format) {
    const extday = day;
    extday.extend(customParseFormat);
    return extday(date, format);
}

export function dformat(date = new Date(), format = 'YYYY-MM-DDTHH:mm') {
    return day.utc(date).tz('America/Lima').format(format);
}

export function dformatLocal(date = new Date(), format = 'YYYY-MM-DDTHH:mm') {
    return day(date).format(format);
}

export function isAfterFromNow(date) {
    return day().isAfter(date);
}

export function isBeforeFromNow(date) {
    return day().isBefore(date);
}

export function diffToNow(from, format = 's') {
    return day().diff(from, format);
}

export function humanizeDuration(minutes) {
    const extday = day;
    extday.extend(duration);
    extday.extend(relativeTime);
    return extday.duration(minutes, 'minutes').humanize();
}

export function dcalendar(date) {
    const extday = day;
    extday.extend(calendar);
    return extday(date).calendar(null, {
        sameDay: '[Hoy a las] h:mm a',
        lastDay: '[Ayer a las] h:mm a',
        nextDay: '[Mañana a las] h:mm a',
        lastWeek: '[el] dddd [pasado a las] h:mm a',
        nextWeek: 'dddd [a las] h:mm a',
        sameElse: 'DD [de] MMM [a las] h:mm a'
    });
}

export function relative(date) {
    const extday = day;
    extday.extend(relativeTime);
    return extday(date).startOf('minutes').fromNow();
}

export const isToday = (someDate) => {
    const today = new Date();
    return someDate.getDate() === today.getDate() && someDate.getMonth() === today.getMonth() && someDate.getFullYear() === today.getFullYear();
};

export default day;
export function compareDates(date1, date2) {
    const day1 = day(date1, 'YYYY-MM-DD');
    const day2 = day(date2, 'YYYY-MM-DD');
    if (day1.isBefore(day2)) {
        return -1;
    } else if (day1.isAfter(day2)) {
        return 1;
    } else {
        return 0;
    }
}
