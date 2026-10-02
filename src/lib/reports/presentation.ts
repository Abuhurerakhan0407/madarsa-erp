import type {Locale} from '@/lib/i18n/config';

type UiLocale='en'|'ur';

const dateOnlyColumns=new Set(['date_of_birth','joined_on','revision_due','attendance_date']);
const dateTimeColumns=new Set(['submitted_at','converted_at','marked_at','occurred_at']);
const timeColumns=new Set(['check_in','check_out']);
const percentageColumns=new Set(['percentage','utilization_pct','absence_rate','late_rate','attendance_rate','exam_average']);
const enumColumns=new Set(['gender','status','state','source','latest_category','latest_outcome','contract_type','attendance_today','progress_method','outcome']);

const urduEnum:Record<string,string>={
 active:'فعال',inactive:'غیر فعال',pending:'زیرِ التوا',draft:'مسودہ',submitted:'جمع شدہ',reviewed:'جائزہ شدہ',approved:'منظور شدہ',converted:'طالب علم بنا',rejected:'مسترد',enrolled:'داخل',published:'جاری شدہ',results_published:'نتائج جاری',
 present:'حاضر',absent:'غیر حاضر',late:'تاخیر',excused:'معاف',leave:'رخصت',incomplete:'نامکمل',withheld:'روکا گیا',exempt:'مستثنیٰ',pass:'کامیاب',passed:'کامیاب',fail:'ناکام',failed:'ناکام',
 male:'مرد',female:'خاتون',manual:'دستی',biometric:'بایومیٹرک',full_time:'کل وقتی',part_time:'جز وقتی',contract:'معاہدہ',lesson:'سبق',page:'صفحہ',surah:'سورت',juz:'سپارہ'
};

const uiLocale=(locale:Locale):UiLocale=>locale==='ur'?'ur':'en';
const localeTag=(locale:Locale)=>uiLocale(locale)==='ur'?'ur-PK':'en-GB';
const titleize=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,match=>match.toUpperCase());

function dateOnly(value:string,locale:Locale){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 if(!match)return null;
 const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
 return new Intl.DateTimeFormat(localeTag(locale),{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}

function dateTime(value:string,locale:Locale){
 const date=new Date(value);
 if(Number.isNaN(date.valueOf()))return null;
 return new Intl.DateTimeFormat(localeTag(locale),{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
}

function enumLabel(value:string,locale:Locale){
 const normalized=value.trim().toLowerCase();
 if(uiLocale(locale)==='ur')return urduEnum[normalized]??value.replaceAll('_',' ');
 return titleize(normalized);
}

function objectSummary(value:object,locale:Locale):string{
 if(Array.isArray(value))return value.length?value.map(item=>typeof item==='object'?objectSummary(item as object,locale):String(item)).join(' · '):'—';
 const entries=Object.entries(value as Record<string,unknown>);
 if(!entries.length)return '—';
 return entries.slice(0,4).map(([key,item])=>`${uiLocale(locale)==='ur'?key.replaceAll('_',' '):titleize(key)}: ${item===null||item===undefined||item===''?'—':typeof item==='object'?'…':String(item)}`).join(' · ');
}

export function formatReportCell(column:string,value:unknown,locale:Locale):string{
 if(value===null||value===undefined||value==='')return '—';
 if(typeof value==='boolean')return value?(uiLocale(locale)==='ur'?'ہاں':'Yes'):(uiLocale(locale)==='ur'?'نہیں':'No');
 if(typeof value==='object')return objectSummary(value,locale);
 if(percentageColumns.has(column)){
  const numeric=Number(value);
  if(Number.isFinite(numeric))return `${new Intl.NumberFormat(localeTag(locale),{maximumFractionDigits:2}).format(numeric)}%`;
 }
 const stringValue=String(value);
 if(dateOnlyColumns.has(column))return dateOnly(stringValue,locale)??stringValue;
 if(dateTimeColumns.has(column))return dateTime(stringValue,locale)??stringValue;
 if(timeColumns.has(column)){
  const time=/^(\d{2}):(\d{2})/.exec(stringValue);
  if(time)return `${time[1]}:${time[2]}`;
  return dateTime(stringValue,locale)??stringValue;
 }
 if(enumColumns.has(column))return enumLabel(stringValue,locale);
 return stringValue;
}
