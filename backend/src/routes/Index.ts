import { Router } from 'express';
import menuRoutes from './menu';
import orderRoutes from './order';
import inventoryRoutes from './Inventory';
import settingRoutes from './setting';
import dashboardRoutes from './dashboard';
import customerRoutes from './customer';
import reportsRoutes from './reports';


const router = Router();

router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/setting', settingRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/customers', customerRoutes);
router.use('/reports', reportsRoutes);

export default router;