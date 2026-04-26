/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ErpProvider } from "./context/ErpContext";
import { Layout } from "./components/Layout";

export default function App() {
  return (
    <ErpProvider>
      <Layout />
    </ErpProvider>
  );
}
