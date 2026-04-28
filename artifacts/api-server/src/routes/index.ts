import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import tournamentsRouter from "./tournaments";
import eloRouter from "./elo";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(tournamentsRouter);
router.use(eloRouter);
router.use(importRouter);

export default router;
