import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiClient } from '../api-client.js';
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
      const result = await client.delete(`/payment_account/remove_payment_account/${user_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'payment_account_update',
    'Update payment account information',
    {
      user_id: z.string().describe('The user ID'),
      email: z.string().optional().describe('Payment email'),
      first_name: z.string().optional().describe('First name'),
      last_name: z.string().optional().describe('Last name'),
      phone: z.string().optional().describe('Phone number'),
    },
    async ({ user_id, email, first_name, last_name, phone }) => {
      const client = getApiClient();
      const body: Record<string, unknown> = {};
      if (email) body.email = email;
      if (first_name) body.first_name = first_name;
      if (last_name) body.last_name = last_name;
      if (phone) body.phone = phone;
      const result = await client.post<PaymentAccount>(`/payment_account/update_payment_account/${user_id}`, body);
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
      const result = await client.get<PaymentAccount>(`/payment_account/get_user_payment_account/${user_id}`);
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
      const result = await client.get<PaymentAccount>(`/payment_account/get_project_payment_account/${project_id}`);
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
      const result = await client.get<Transaction[]>(`/payment_account/get_payment_account_transactions_history/${payment_account_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
};
