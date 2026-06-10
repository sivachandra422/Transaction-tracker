import morgan from "morgan";
import { RequestHandler } from "express";

/** Concise request logger: method + url + status + response-time */
export const requestLogger: RequestHandler = morgan(
  ":method :url :status :res[content-length]b - :response-time ms"
);
