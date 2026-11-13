# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses by category, view a running total balance, and visualize spending distribution through a pie chart. The application runs entirely in the browser with no backend, using HTML, CSS, and Vanilla JavaScript. All data is persisted locally via the browser's Local Storage API, making the app usable as a standalone web page or as a browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: One of three predefined spending groups: Food, Transport, or Fun.
- **Transaction_List**: The scrollable UI component that displays all stored transactions.
- **Balance_Display**: The UI component at the top of the page that shows the computed total of all transaction amounts.
- **Input_Form**: The HTML form used to capture a new transaction's item name, amount, and category.
- **Chart**: The pie chart component that visualizes spending distribution by category.
- **Storage**: The browser's Local Storage API used to persist transaction data.
- **Validator**: The client-side logic responsible for checking that all required form fields are filled and that the amount is a positive number before a transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to enter an expense with a name, amount, and category so that I can record where my money is going.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for the item name with a maximum length of 100 characters, a numeric field for the amount, and a dropdown selector for the category (Food, Transport, Fun).
2. WHEN the user submits the Input_Form with all fields filled and an amount between 0.01 and 999,999,999.99 inclusive, THE App SHALL add a new Transaction to the Transaction_List and persist it to Storage.
3. IF the user submits the Input_Form with any field empty, THEN THE Validator SHALL display an inline error message adjacent to each missing field indicating which field is required and SHALL prevent the Transaction from being saved.
4. IF the user submits the Input_Form with an amount that is zero, negative, greater than 999,999,999.99, or non-numeric, THEN THE Validator SHALL display an inline error message adjacent to the amount field indicating the valid range and SHALL prevent the Transaction from being saved.
5. WHEN a Transaction is successfully added, THE Input_Form SHALL reset the item name field to empty, the amount field to empty, and the category dropdown to its first option (Food).
6. IF Storage fails to persist a submitted Transaction, THEN THE App SHALL display an error message indicating the Transaction could not be saved and SHALL preserve the entered field values in the Input_Form.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored Transactions, each showing the item name, the amount formatted with a currency symbol and two decimal places, and the category.
2. WHEN the number of Transactions exceeds the visible area of the Transaction_List, THE Transaction_List SHALL be scrollable to allow the user to view all entries.
3. WHEN the user clicks the delete button displayed on a Transaction entry, THE App SHALL remove that Transaction from the Transaction_List and from Storage.
4. WHEN no Transactions have been added, THE Transaction_List SHALL display a placeholder message indicating that no expenses have been recorded.
5. WHEN the App is loaded, THE Transaction_List SHALL restore and display all Transactions previously persisted in Storage.
6. IF Storage is unavailable when the App is loaded, THEN THE Transaction_List SHALL display a placeholder message indicating that saved data could not be loaded.
7. IF Storage fails when the user clicks the delete button on a Transaction entry, THEN THE App SHALL display an error message indicating the deletion could not be saved and SHALL retain the Transaction in the Transaction_List.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total expenses at a glance so that I can understand my overall spending at any time.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts in the Transaction_List, where each Transaction amount is treated as a positive value, displayed with a currency symbol and two decimal places (e.g., $0.00).
2. WHEN a new Transaction is added, THE Balance_Display SHALL update to reflect the new total within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the recalculated total within 1 second without requiring a page reload.
4. WHEN no Transactions exist, THE Balance_Display SHALL show a formatted zero value consistent with the display format defined in criterion 1 (e.g., $0.00).
5. WHEN the App is loaded, THE Balance_Display SHALL calculate and show the total based on all Transactions restored from Storage, using the display format defined in criterion 1.
6. IF Storage is unavailable when the App is loaded, THEN THE Balance_Display SHALL show a formatted zero value and display an error message indicating that saved Transactions could not be loaded.

---

### Requirement 4: Category Pie Chart

**User Story:** As a user, I want to see a visual breakdown of my spending by category so that I can quickly identify where most of my money goes.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart where each segment represents a category present in the Transaction_List, sized proportionally by the sum of Transaction amounts for that category relative to the total sum of all Transaction amounts.
2. WHEN a new Transaction is added, THE Chart SHALL update automatically to reflect the new spending distribution without requiring a page reload.
3. WHEN a Transaction is deleted, THE Chart SHALL update automatically to reflect the revised spending distribution without requiring a page reload.
4. WHEN only one or two categories have a total spending amount greater than zero, THE Chart SHALL render only the segments for those categories with a non-zero total.
5. WHEN no Transactions exist, THE Chart SHALL display a placeholder text indicating no spending data is available and render no pie segments.
6. WHEN the App is loaded, THE Chart SHALL render the correct distribution based on all Transactions restored from Storage.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my expense data to be saved between browser sessions so that I do not lose my records when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL serialize the updated Transaction dataset as JSON and write it to Storage under a fixed, unchanging key.
2. WHEN a Transaction is deleted, THE App SHALL serialize the updated Transaction dataset as JSON and write it to Storage under the same fixed key, omitting the deleted entry.
3. WHEN the App is loaded, THE App SHALL read and deserialize the JSON Transaction dataset from Storage and restore the Transaction_List, Balance_Display, and Chart before accepting any user input.
4. IF the JSON stored under the data key cannot be parsed, THEN THE App SHALL initialize with an empty Transaction_List and display a non-blocking warning message to the user.
5. IF the parsed JSON does not contain the expected Transaction fields, THEN THE App SHALL ignore invalid entries, initialize with only well-formed Transactions, and display a non-blocking warning message to the user.
6. IF Storage fails to write when a Transaction is added or deleted, THEN THE App SHALL display a non-blocking error message indicating the data could not be saved and SHALL reflect the change in the UI without persisting it.

---

### Requirement 6: Technology and Compatibility Constraints

**User Story:** As a developer, I want the App to be built with vanilla web technologies and no server so that it can run as a standalone file or browser extension without any build step.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript with no JavaScript frameworks, transpilation steps, or third-party utility libraries, except for the designated charting library loaded via CDN.
2. THE App SHALL use a single CSS file located inside a `css/` directory for all styling.
3. THE App SHALL use a single JavaScript file located inside a `js/` directory for all application logic.
4. THE App SHALL function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari.
5. WHERE a charting library is used, THE App SHALL load it via a CDN `<script>` tag and SHALL NOT require a local package manager installation.
6. THE App SHALL require no backend server and SHALL operate entirely from the local file system or as a browser extension.
7. IF the CDN charting library fails to load, THEN THE App SHALL display a message in the chart area indicating the chart is unavailable and SHALL continue to function for all other features (form, list, balance).

---

### Requirement 7: Performance and Visual Design

**User Story:** As a user, I want the App to load quickly and present a clean, readable interface so that I can use it efficiently without distraction.

#### Acceptance Criteria

1. THE App SHALL render all UI components and restore persisted data within 2 seconds on an unthrottled modern desktop browser with no developer tools throttling applied.
2. WHEN the user interacts with the Input_Form or deletes a Transaction, THE App SHALL update the Transaction_List, Balance_Display, and Chart within 100 milliseconds of the interaction completing.
3. THE App SHALL apply a clear visual hierarchy so that the Balance_Display, Input_Form, Transaction_List, and Chart are each separated by a visible border, a distinct background color, or at least 16px of whitespace from adjacent sections.
4. THE App SHALL use a legible font size of at least 14px for all body text and labels.
5. THE App SHALL present only the following controls: the Input_Form fields, the submit button, and per-Transaction delete buttons. No other interactive controls SHALL be present in the interface.
