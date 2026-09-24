import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import employeesRouter from "./employees";
import jobsRouter from "./jobs";
import applicantsRouter from "./applicants";
import attendanceRouter from "./attendance";
import leavesRouter from "./leaves";
import requestsRouter from "./requests";
import appraisalsRouter from "./appraisals";
import trainingRouter from "./training";
import grievancesRouter from "./grievances";
import incidentsRouter from "./incidents";
import offboardingsRouter from "./offboardings";
import onboardingsRouter from "./onboardings";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(employeesRouter);
router.use(jobsRouter);
router.use(applicantsRouter);
router.use(attendanceRouter);
router.use(leavesRouter);
router.use(requestsRouter);
router.use(appraisalsRouter);
router.use(trainingRouter);
router.use(grievancesRouter);
router.use(incidentsRouter);
router.use(offboardingsRouter);
router.use(onboardingsRouter);

export default router;
