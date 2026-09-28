import { Router } from 'express';
import healthRouter from './health.routes';
import authRouter from './auth.routes';
import orderRouter from './order.routes';
import analyticsRouter from './analytics.routes';
import shopifyRouter from './shopify.routes';
import whatsappRouter from './whatsapp.routes';

const v1Router = Router();

// Health check endpoint
v1Router.use('/health', healthRouter);

// Authentication endpoints
v1Router.use('/auth', authRouter);

// Orders management endpoints
v1Router.use('/orders', orderRouter);

// Analytics endpoints
v1Router.use('/analytics', analyticsRouter);

// Shopify integration & webhooks
v1Router.use('/shopify', shopifyRouter);

// Meta WhatsApp Cloud API integration & webhooks
v1Router.use('/whatsapp', whatsappRouter);

export default v1Router;
