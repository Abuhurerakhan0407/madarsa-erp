export const furkaniaProfile = {
  key: "madrasa_e_furkania",
  displayName: "Madrasa-e-Furkania",
  status: "client_configuration_in_progress" as const,

  // Confirmed client facts only. Unknown operational rules stay null until
  // Madrasa-e-Furkania confirms them; do not turn product defaults into facts.
  students: {
    currentCount: 180,
    approximateAgeRange: {
      min: 4,
      max: 18,
    },
  },

  curriculum: {
    family: "deeniyat" as const,
    track: "primary_1_to_5" as const,
    courses: [1, 2, 3, 4, 5] as const,
    // Official Deeniyat subject families used as the initial ERP taxonomy.
    // Course-specific chapters/components remain editable in Programs & Syllabus.
    subjectGroups: [
      "quraan",
      "hadeeth",
      "aqaaid_and_masaail",
      "islamic_upbringing",
      "language",
    ] as const,
    nurseryOrQaidaPlacementForYoungStudents: null,
    exactBookVersionOrMedium: null,
    mixedGenderGroups: null,
  },

  scheduling: {
    shifts: ["morning", "midday", "evening"] as const,
    exactShiftTimes: null,
    studentDistributionByShift: null,
    fixedShiftPerStudent: null,
    allowShiftSwitchOrMakeup: null,
    operatingDays: null,
  },

  staff: {
    exactTeacherCount: null,
    teachersMayCoverMultipleCourses: null,
    teachersMayCoverMultipleShifts: null,
  },

  attendance: {
    studentMethod: null,
    staffMethod: null,
    absenceAlerts: null,
    lateAlerts: null,
    // Privacy-safe invariant: never store fingerprint/face templates in Ilmgaah.
    storeRawBiometricMaterial: false,
  },

  fees: {
    structure: null,
    paymentModes: null,
    admissionFee: null,
    booksFee: null,
    examFee: null,
  },

  notifications: {
    whatsappEnabled: null,
    events: null,
  },

  academics: {
    examCadence: null,
    marksStructure: null,
    promotionRule: null,
    quranProgressTracking: null,
    homeworkTracking: null,
  },

  access: {
    roles: null,
    uiLanguages: null,
  },

  records: {
    migrationSource: null,
    requiredPrintouts: null,
  },

  branding: {
    officialName: "Madrasa-e-Furkania",
    logo: null,
    address: null,
    contact: null,
    clientSubdomain: null,
  },

  pendingClientDetails: [
    "exact_shift_times",
    "student_distribution_by_shift",
    "shift_switch_or_makeup_policy",
    "operating_days",
    "young_student_nursery_or_qaida_placement",
    "deeniyat_book_version_or_medium",
    "boys_girls_grouping",
    "teacher_count_and_assignment_rules",
    "attendance_method_and_alerts",
    "fee_structure_and_payment_modes",
    "whatsapp_notification_scope",
    "exam_marks_and_promotion_rules",
    "quran_progress_and_homework_tracking",
    "staff_roles_and_permissions",
    "record_migration_source",
    "required_printouts",
    "ui_languages",
    "official_logo_address_and_contact",
    "client_subdomain",
  ] as const,
} as const;

export type FurkaniaProfile = typeof furkaniaProfile;
