import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import tournamentsRouter from "./tournaments";
import eloRouter from "./elo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(tournamentsRouter);
router.use(eloRouter);

export default router;
