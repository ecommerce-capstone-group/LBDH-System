import {
  db,
  employees,
  jobs,
  applicants,
  attendance,
  leaves,
  requests,
  appraisals,
  grievances,
  pool,
} from "@workspace/db";
import type { Requirement, RequirementMatch, ApprovalStep } from "@workspace/db";

async function run() {
  const existing = await db.select().from(employees).limit(1);
  if (existing.length > 0) {
    console.log("Already seeded.");
    await pool.end();
    return;
  }

  const today = new Date();
  const addDays = (d: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  };

  const emps = await db
    .insert(employees)
    .values([
      {
        name: "Maria Santos",
        role: "Registered Nurse",
        department: "ICU",
        email: "maria.santos@lbdh.org",
        phone: "+63 917 555 0101",
        licenseName: "PRC Nursing License",
        licenseExpiry: addDays(18),
        documents: "PRC ID, BLS Cert, IV Therapy",
        vlBalance: 12,
        slBalance: 10,
      },
      {
        name: "Juan Dela Cruz",
        role: "Resident Physician",
        department: "Emergency",
        email: "juan.delacruz@lbdh.org",
        phone: "+63 917 555 0102",
        licenseName: "PRC Medical License",
        licenseExpiry: addDays(120),
        documents: "PRC ID, ACLS, ATLS",
        vlBalance: 15,
        slBalance: 15,
      },
      {
        name: "Anna Reyes",
        role: "Medical Technologist",
        department: "Laboratory",
        email: "anna.reyes@lbdh.org",
        phone: "+63 917 555 0103",
        licenseName: "PRC Medtech License",
        licenseExpiry: addDays(-10),
        documents: "PRC ID",
        vlBalance: 8,
        slBalance: 9,
      },
      {
        name: "Carlo Mendoza",
        role: "Radiologic Technologist",
        department: "Radiology",
        email: "carlo.mendoza@lbdh.org",
        phone: "+63 917 555 0104",
        licenseName: "PRC RadTech License",
        licenseExpiry: addDays(220),
        documents: "PRC ID, Safety Cert",
        vlBalance: 14,
        slBalance: 12,
      },
      {
        name: "Liza Bautista",
        role: "HR Coordinator",
        department: "Human Resources",
        email: "liza.bautista@lbdh.org",
        phone: "+63 917 555 0105",
        documents: "Employee Handbook",
        vlBalance: 13,
        slBalance: 11,
      },
    ])
    .returning();

  const nurseReq: Requirement[] = [
    { label: "Active PRC License", kind: "checkbox", weight: 30 },
    { label: "BLS Certification", kind: "checkbox", weight: 15 },
    { label: "ACLS Certification", kind: "checkbox", weight: 15 },
    { label: "Years of Experience", kind: "number", weight: 30, max: 5 },
    { label: "ICU Rotations Completed", kind: "number", weight: 10, max: 3 },
  ];

  const medtechReq: Requirement[] = [
    { label: "Active PRC Medtech License", kind: "checkbox", weight: 40 },
    { label: "Hospital Lab Experience (years)", kind: "number", weight: 35, max: 4 },
    { label: "Phlebotomy Certified", kind: "checkbox", weight: 25 },
  ];

  const jobsRows = await db
    .insert(jobs)
    .values([
      {
        title: "Staff Nurse - ICU",
        department: "ICU",
        description:
          "Provide direct patient care in the Intensive Care Unit. Monitor critically ill patients, administer medications, and collaborate with the medical team.",
        requirements: nurseReq,
        status: "active",
      },
      {
        title: "Medical Technologist",
        department: "Laboratory",
        description:
          "Perform laboratory tests on patient samples, maintain quality control, and report results accurately.",
        requirements: medtechReq,
        status: "active",
      },
      {
        title: "Finance & Accounting Manager",
        department: "Finance",
        description: [
          "Graduate of Bachelor of Science in Accountancy, Finance, or any related course",
          "With at least 5 years managerial experience in Finance and Accounting",
          "Preferably with hospital or healthcare industry experience",
          "Strong background in financial reporting, budgeting and forecasting, and general accounting",
          "Knowledgeable in Philippine accounting standards, BIR regulations, and DOH compliance",
          "Excellent leadership and people management skills",
          "Able to work under pressure and meet deadlines",
        ].join("\n"),
        requirements: [
          { label: "Bachelor's Degree", kind: "checkbox", weight: 30 },
          { label: "Years of Experience", kind: "number", weight: 50, max: 3 },
          { label: "Hospital Billing Background", kind: "checkbox", weight: 20 },
        ],
        status: "active",
      },
    ])
    .returning();

  function scoreApplicant(
    reqs: Requirement[],
    answers: Record<string, boolean | number>,
  ) {
    let total = 0;
    const matches: RequirementMatch[] = [];
    for (const r of reqs) {
      const value = answers[r.label];
      let s = 0;
      if (r.kind === "checkbox") s = value === true ? r.weight : 0;
      else {
        const num = typeof value === "number" ? value : 0;
        const max = r.max && r.max > 0 ? r.max : 1;
        s = Math.min(num / max, 1) * r.weight;
      }
      total += s;
      matches.push({
        label: r.label,
        kind: r.kind,
        value: value ?? (r.kind === "checkbox" ? false : 0),
        score: Math.round(s * 100) / 100,
        weight: r.weight,
      });
    }
    return {
      totalScore: Math.min(Math.round(total * 100) / 100, 100),
      matches,
    };
  }

  const nurseJob = jobsRows[0]!;
  const medtechJob = jobsRows[1]!;

  const a1 = scoreApplicant(nurseReq, {
    "Active PRC License": true,
    "BLS Certification": true,
    "ACLS Certification": true,
    "Years of Experience": 4,
    "ICU Rotations Completed": 3,
  });
  const a2 = scoreApplicant(nurseReq, {
    "Active PRC License": true,
    "BLS Certification": true,
    "ACLS Certification": false,
    "Years of Experience": 2,
    "ICU Rotations Completed": 1,
  });
  const a3 = scoreApplicant(medtechReq, {
    "Active PRC Medtech License": true,
    "Hospital Lab Experience (years)": 3,
    "Phlebotomy Certified": true,
  });

  await db.insert(applicants).values([
    {
      jobId: nurseJob.id,
      name: "Patricia Lim",
      email: "patricia.lim@example.com",
      phone: "+63 917 555 0201",
      skills: "IV therapy, ventilator management, EKG interpretation",
      experience: "4 years ICU at St. Luke's; 1 year ER",
      resume:
        "BSN, University of the Philippines Manila, 2020. PRC #0123456. Active member of PNA.",
      totalScore: a1.totalScore,
      matches: a1.matches,
    },
    {
      jobId: nurseJob.id,
      name: "Mark Villanueva",
      email: "mark.villanueva@example.com",
      phone: "+63 917 555 0202",
      skills: "Bedside care, wound dressing, basic emergency response",
      experience: "2 years ward nurse",
      resume: "BSN, San Beda, 2022. PRC #0987654.",
      totalScore: a2.totalScore,
      matches: a2.matches,
    },
    {
      jobId: medtechJob.id,
      name: "Sofia Gomez",
      email: "sofia.gomez@example.com",
      phone: "+63 917 555 0203",
      skills: "Hematology, urinalysis, phlebotomy, QA",
      experience: "3 years at private hospital lab",
      resume: "BS MedTech, FEU 2021. PRC #5566778.",
      totalScore: a3.totalScore,
      matches: a3.matches,
    },
  ]);

  const dateStr = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const attendanceRows = [];
  for (let i = 0; i < 10; i++) {
    const offset = -i;
    attendanceRows.push({
      employeeId: emps[0]!.id,
      date: dateStr(offset),
      status: i === 4 ? "Absent" : "Present",
      lateMinutes: i % 3 === 0 ? 15 : 0,
      undertimeMinutes: i === 2 ? 20 : 0,
      overtimeMinutes: i % 4 === 0 ? 60 : 0,
    });
    attendanceRows.push({
      employeeId: emps[1]!.id,
      date: dateStr(offset),
      status: "Present",
      lateMinutes: i === 1 ? 10 : 0,
      undertimeMinutes: 0,
      overtimeMinutes: i % 5 === 0 ? 90 : 0,
    });
  }
  await db.insert(attendance).values(attendanceRows);

  const baseSteps = (): ApprovalStep[] => [
    { name: "Unit Head", status: "pending" },
    { name: "Department Head", status: "pending" },
    { name: "Auto", status: "pending" },
  ];

  await db.insert(leaves).values([
    {
      employeeId: emps[0]!.id,
      leaveType: "VL",
      startDate: dateStr(7),
      endDate: dateStr(9),
      days: 3,
      reason: "Family vacation in Baguio",
      status: "pending",
      currentStep: "Unit Head",
      steps: baseSteps(),
    },
    {
      employeeId: emps[1]!.id,
      leaveType: "SL",
      startDate: dateStr(-3),
      endDate: dateStr(-2),
      days: 2,
      reason: "Flu recovery",
      status: "approved",
      currentStep: "Approved",
      steps: [
        { name: "Unit Head", status: "approved", actor: "HR", timestamp: new Date().toISOString() },
        { name: "Department Head", status: "approved", actor: "HR", timestamp: new Date().toISOString() },
        { name: "Auto", status: "approved", actor: "system", timestamp: new Date().toISOString() },
      ],
    },
  ]);

  await db.insert(requests).values([
    {
      employeeId: emps[0]!.id,
      type: "overtime",
      title: "OT for ICU coverage",
      details: "4 hours OT on " + dateStr(-1) + " due to staffing gap",
      status: "pending",
      currentStep: "Unit Head",
      steps: baseSteps(),
    },
    {
      employeeId: emps[3]!.id,
      type: "training",
      title: "CT Imaging Workshop",
      details: "3-day CT advanced imaging workshop in Manila",
      status: "pending",
      currentStep: "Department Head",
      steps: [
        { name: "Unit Head", status: "approved", actor: "Unit Head", timestamp: new Date().toISOString() },
        { name: "Department Head", status: "pending" },
        { name: "Auto", status: "pending" },
      ],
    },
    {
      employeeId: emps[1]!.id,
      type: "certificate",
      title: "Certificate of Employment",
      details: "Needed for housing loan application",
      status: "pending",
      currentStep: "Unit Head",
      steps: baseSteps(),
    },
  ]);

  await db.insert(appraisals).values([
    {
      employeeId: emps[0]!.id,
      kind: "Annual",
      score: 4.5,
      notes: "Excellent ICU performance, strong patient advocacy.",
      evaluator: "Dr. Ramos (ICU Head)",
    },
    {
      employeeId: emps[1]!.id,
      kind: "Regularization",
      score: 4.2,
      notes: "Adapted quickly to ER pace; shows leadership potential.",
      evaluator: "Dr. Cruz (ER Chief)",
    },
  ]);

  await db.insert(grievances).values([
    {
      employeeId: emps[2]!.id,
      subject: "Lab equipment downtime",
      description:
        "Hematology analyzer down 3x this month, slowing turnaround.",
      status: "open",
    },
  ]);

  console.log("Seeded HR data.");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
