import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiPath, getApiClient } from '../api-client.js';
import type { PaymentAccount, Transaction } from '../types.js';

export const registerPaymentAccountTools = (server: McpServer) => {
  server.tool(
    'payment_account_remove',
    'Remove payment account from user',
    {
      user_id: z.string().describe('The user ID'),
    },
    async ({ user_id }) => {
      const client = getApiClient();
      const result = await client.delete(apiPath`/payment_account/remove_payment_account/${user_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'payment_account_update',
    'Update payment account settings: name and automatic balance refill',
    {
      user_id: z.string().describe('The user ID'),
      payment_account_name: z.string().optional().describe('New name of the payment account'),
      auto_money_refill_enabled: z.boolean().optional().describe('Enable or disable automatic balance refill'),
      auto_money_refill_amount: z.number().optional().describe('Automatic refill amount in USD'),
    },
    async ({ user_id, payment_account_name, auto_money_refill_enabled, auto_money_refill_amount }) => {
      const client = getApiClient();
      const body: Record<string, unknown> = {};
      if (payment_account_name !== undefined) body.payment_account_name = payment_account_name;
      if (auto_money_refill_enabled !== undefined) body.auto_money_refill_enabled = auto_money_refill_enabled;
      if (auto_money_refill_amount !== undefined) body.auto_money_refill_amount = auto_money_refill_amount;
      const result = await client.post<PaymentAccount>(apiPath`/payment_account/update_payment_account/${user_id}`, body);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'payment_account_get_by_user',
    'Get payment account by user ID',
    {
      user_id: z.string().describe('The user ID'),
    },
    async ({ user_id }) => {
      const client = getApiClient();
      const result = await client.get<PaymentAccount>(apiPath`/payment_account/get_user_payment_account/${user_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'payment_account_get_by_project',
    'Get payment account by project ID',
    {
      project_id: z.string().describe('The project ID'),
    },
    async ({ project_id }) => {
      const client = getApiClient();
      const result = await client.get<PaymentAccount>(apiPath`/payment_account/get_project_payment_account/${project_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'payment_account_get_transactions',
    'Get payment transactions history for an account',
    {
      payment_account_id: z.string().describe('The payment account ID'),
    },
    async ({ payment_account_id }) => {
      const client = getApiClient();
      const result = await client.get<Transaction[]>(apiPath`/payment_account/get_payment_account_transactions_history/${payment_account_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
};
