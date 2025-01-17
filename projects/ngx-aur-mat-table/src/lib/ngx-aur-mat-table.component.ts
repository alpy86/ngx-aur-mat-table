import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {ColumnView, ColumnConfig, TableConfig} from './model/ColumnConfig';
import {MatSort, Sort} from '@angular/material/sort';
import {MatTableDataSource} from '@angular/material/table';
import {MatPaginator} from '@angular/material/paginator';
import {SelectionProvider} from './providers/SelectionProvider';
import {ActionEvent, RowActionProvider} from './providers/RowActionProvider';
import {TableRow} from "./model/TableRow";
import {TableViewConverter} from "./providers/TableViewConverter";
import {IndexProvider} from "./providers/IndexProvider";
import {TableDataProvider} from "./providers/TableDataProvider";
import {PaginationProvider} from "./providers/PaginationProvider";

export interface HighlightContainer<T> {
  value: any;
}

export interface ColumnOffset {
  left: number,
  width: number
}

@Component({
  selector: 'aur-mat-table',
  templateUrl: './ngx-aur-mat-table.component.html',
  styleUrls: ['./ngx-aur-mat-table.component.scss'],
})
export class NgxAurMatTableComponent<T> implements OnInit, OnChanges, AfterViewInit, OnDestroy {

  public tableDataSource = new MatTableDataSource<TableRow<T>>([]);
  public displayedColumns: string[] = [];

  private tableView: Map<string, ColumnView<string>>[] = [];

  // @ts-ignore
  @ViewChildren('rowLink', {read: ElementRef}) rows: QueryList<ElementRef>;
  // @ts-ignore
  @ViewChild('table', {read: ElementRef}) table: ElementRef;

  // @ts-ignore
  @Input() tableConfig: TableConfig<T>;

  @Input() tableData: T[] = [];

  // @ts-ignore
  @ViewChild(MatPaginator, {static: false}) matPaginator: MatPaginator;
  // @ts-ignore
  @ViewChild(MatSort, {static: true}) matSort: MatSort;

  @Output() sort: EventEmitter<Sort> = new EventEmitter();

  // events if enabled actions
  @Output() onRowAction: EventEmitter<ActionEvent<T>> = new EventEmitter<ActionEvent<T>>();
  // -----------------------

  // events if enabled select event
  @Output() selected = new EventEmitter<T[]>();
  @Output() onSelect = new EventEmitter<T[]>();
  @Output() onDeselect = new EventEmitter<T[]>();
  //------------------------


  @Output() onRowClick = new EventEmitter<T>();

  /**
   * return filtered rows
   */
  @Output() onFilter = new EventEmitter<T[]>();

  @Output() columnOffsets = new EventEmitter<ColumnOffset[]>();

  // @ts-ignore
  private resizeColumnOffsetsObserver: ResizeObserver;

  // @ts-ignore
  selectionProvider: SelectionProvider<T>;
  // @ts-ignore
  rowActionsProvider: RowActionProvider<T>;

  // @ts-ignore
  indexProvider: IndexProvider;

  // @ts-ignore
  paginationProvider: PaginationProvider;

  tableDataProvider = new TableDataProvider<T>();

  highlighted: T | undefined;

  //значение передается в контейнере иначе OnChange не видит изменений когда передаются одинаковые значение и подсветка строки не отключается
  // @ts-ignore
  @Input() highlight: HighlightContainer<T> | undefined;

  constructor() {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tableData'] && this.tableData) {
      this.prepare();
    }
    if (changes['highlight'] && this.highlight) {
      this.doExternalHighlightRow(this.highlight);
    }
  }

  private doExternalHighlightRow(h: HighlightContainer<T>) {
    if (this.highlighted === h.value) {
      this.highlight = undefined;
      this.highlighted = undefined;
    } else {
      this.highlighted = h.value;
      const index = this.tableDataSource.data.findIndex(row => row.rowSrc === h.value);
      if (index >= 0) {
        this.rows?.toArray()[index]?.nativeElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center"
        });
      }
    }
  }

  ngOnInit(): void {
    if (!this.tableConfig) {
      throw new Error("init inputs [tableConfig] is mandatory!")
    }
  }

  // we need this, in order to make pagination work with *ngIf
  ngAfterViewInit(): void {
    this.tableDataSource.paginator = this.matPaginator;
    this.updateColumnOffsets();
    this.resizeColumnOffsetsObserver = new ResizeObserver(() => this.updateColumnOffsets());
    this.resizeColumnOffsetsObserver.observe(this.table.nativeElement);
  }

  private updateColumnOffsets() {
    const offsets: ColumnOffset[] = Array.from(this.table.nativeElement.querySelectorAll('th'))
      .map(c => (c as HTMLElement))
      .map(c => ({left: c.offsetLeft, width: c.offsetWidth}))
    this.columnOffsets.emit(offsets);
  }

  private prepare() {
    this.setTableDataSource();
    this.tableView = TableViewConverter.toView(this.tableDataSource.data, this.tableConfig)
    this.displayedColumns = this.tableConfig.columnsCfg.map((tableColumn: ColumnConfig<any>) => tableColumn.key);

    if (this.tableConfig.indexCfg && this.tableConfig.indexCfg.enable) {
      this.indexProvider = new IndexProvider(this.tableConfig.indexCfg, this.displayedColumns);
    }
    if (this.tableConfig.actionCfg) {
      this.rowActionsProvider = new RowActionProvider<TableRow<T>>(this.tableConfig.actionCfg, this.displayedColumns);
    }
    if (this.tableConfig.selectionCfg && this.tableConfig.selectionCfg.enable) {
      this.selectionProvider = new SelectionProvider<T>(this.tableConfig.selectionCfg, this.displayedColumns, this.tableDataSource);
      this.selectionProvider.bind(this.selected, this.onSelect, this.onDeselect);
    }
    if (this.tableConfig.pageableCfg) {
      this.paginationProvider = new PaginationProvider(this.tableConfig.pageableCfg);
    }
  }

  private setTableDataSource() {
    let convert = this.tableDataProvider.convert(this.tableData, this.tableConfig.columnsCfg);
    this.tableDataSource = new MatTableDataSource<TableRow<T>>(convert);
    this.tableDataSource.paginator = this.matPaginator;
    this.tableDataSource.sort = this.matSort;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.tableDataSource.filter = filterValue.trim().toLowerCase();
    this.onFilter.emit(this.tableDataSource.filteredData.map(f => f.rowSrc))
  }

  sortTable(sortParameters: Sort) {
    this.sort.emit(sortParameters);
  }

  emitRowAction(action: string, row: T, $event: MouseEvent) {
    $event.stopPropagation();
    this.onRowAction.emit({action, value: row});
  }

  masterToggle() {
    this.selectionProvider.masterToggle();
  }

  isAllSelected(): boolean {
    return this.selectionProvider.isAllSelected();
  }

  castSrc(row: any): TableRow<T> {
    return row;
  }

  getView(row: TableRow<T>, columnKey: string): ColumnView<string> | undefined {
    return this.tableView[row.id] ? this.tableView[row.id].get(columnKey) : undefined;
  }

  rowClick(row: TableRow<T>) {
    if (row.rowSrc !== this.highlighted || (row.rowSrc === this.highlighted && !this.tableConfig.clickCfg?.cancelable)) {
      this.onRowClick.emit(row.rowSrc);
      this.highlighted = row.rowSrc;
    } else {
      this.onRowClick.emit(undefined);
      this.highlighted = undefined;
    }
  }

  ngOnDestroy() {
    // Останавливаем наблюдение при уничтожении компонента
    this.resizeColumnOffsetsObserver.disconnect();
  }
}
