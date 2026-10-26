import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

export function getPublicTrpcErrorMessage(code: string, message: string): string {
  return code === "INTERNAL_SERVER_ERROR"
    ? "An unexpected server error occurred. Please try again."
    : message;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Do not serialize driver, SQL, connection-string, or stack details to a
  // browser. Expected auth/validation errors keep their explicit messages;
  // unexpected failures are recorded by the server logger and are generic to
  // the caller.
  errorFormatter({ shape, error }) {
    if (error.code !== "INTERNAL_SERVER_ERROR") return shape;
    console.error("[tRPC] Internal server error", error);
    return {
      ...shape,
      message: getPublicTrpcErrorMessage(error.code, shape.message),
      data: {
        ...shape.data,
        stack: undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
