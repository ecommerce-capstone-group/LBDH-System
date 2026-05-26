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
import offboardingsRouter from "./offboardings";

const router: IRouter = Router();

router.use(healthRouter);
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
router.use(offboardingsRouter);

export default router;
