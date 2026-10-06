import React from 'react';
import styles from './Table.module.css';

export function Table({
  className = '',
  containerClassName = '',
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { containerClassName?: string }) {
  return (
    <div className={`${styles.container} ${containerClassName}`.trim()}>
      <table className={`${styles.table} ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`${styles.tableHeader} ${className}`.trim()} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`${styles.tableBody} ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
}

export function TableFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={`${styles.tableFooter} ${className}`.trim()} {...props}>
      {children}
    </tfoot>
  );
}

export function TableRow({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({
  numeric = false,
  className = '',
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={`${styles.tableHead} ${numeric ? styles.numeric : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  numeric = false,
  className = '',
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={`${styles.tableCell} ${numeric ? styles.numeric : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableCaption({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption className={`${styles.tableCaption} ${className}`.trim()} {...props}>
      {children}
    </caption>
  );
}
