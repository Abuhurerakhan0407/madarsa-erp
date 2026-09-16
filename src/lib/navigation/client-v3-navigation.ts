import type { Locale } from "@/lib/i18n/config";

export type NavigationAudience = "office" | "teacher";
export type ClientV3NavItem = { key: string; labels: Record<Locale, string>; href: (locale: Locale) => string };
export type ClientV3Navigation = { primary: ClientV3NavItem[]; more: ClientV3NavItem[]; mobile: ClientV3NavItem[] };

const item = (key:string,en:string,ur:string,ar:string,path:(locale:Locale)=>string):ClientV3NavItem=>({key,labels:{en,ur,ar},href:path});

const officePrimary:ClientV3NavItem[]=[
 item("home","Home","ہوم","الرئيسية",l=>`/${l}`),
 item("admissions","Admissions","داخلہ","القبول",l=>`/${l}/admissions`),
 item("students","Students","طلبہ","الطلاب",l=>`/${l}/students`),
 item("attendance","Attendance","حاضری","الحضور",l=>`/${l}/attendance`),
 item("quran","Qur'an & Hifz","قرآن و حفظ","القرآن والحفظ",l=>`/${l}/quran`)
];
const officeMore:ClientV3NavItem[]=[
 item("portals","Parent & Teacher Access","?????? ? ?????? ?????","???? ???????? ?????????",l=>`/${l}/portals`),
 item("teachers","Teachers","اساتذہ","المعلمون",l=>`/${l}/staff`),
 item("exams","Exams","امتحانات","الاختبارات",l=>`/${l}/exams`),
 item("documents","IDs & Documents","ID و دستاویزات","الهويات والمستندات",l=>`/${l}/documents`),
 item("reports","Reports","رپورٹس","التقارير",l=>`/${l}/reports`),
 item("settings","Settings","سیٹنگز","الإعدادات",l=>`/${l}/settings/configuration`)
];
const teacherPrimary:ClientV3NavItem[]=[
 item("home","Home","ہوم","الرئيسية",l=>`/${l}`),
 item("my-students","My Students","میرے طلبہ","طلابي",l=>`/${l}/my-students`),
 item("attendance","Attendance","حاضری","الحضور",l=>`/${l}/attendance`),
 item("quran","Qur'an & Hifz","قرآن و حفظ","القرآن والحفظ",l=>`/${l}/quran`)
];

export function getClientV3Navigation(audience:NavigationAudience):ClientV3Navigation{
 if(audience==="teacher") return {primary:teacherPrimary,more:[],mobile:teacherPrimary};
 return {primary:officePrimary,more:officeMore,mobile:[officePrimary[0],officePrimary[1],officePrimary[2],officePrimary[3]]};
}

export function getSupplementalMobileNavigation(navigation:ClientV3Navigation):ClientV3NavItem[]{
 const quickKeys=new Set(navigation.mobile.map(item=>item.key));
 return [...navigation.primary,...navigation.more].filter(item=>!quickKeys.has(item.key));
}
