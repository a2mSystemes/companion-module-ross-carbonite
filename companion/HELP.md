## Ross Carbonite

Controls a Carbonite switcher series. For now only Cabonite Black Solo (CBF-109) or Carbonite Black Solo 13 (CBF-113) are available. This module uses RossTalk to communicate with teh switcher, and reads tally and source names back with TSL UMD v3.1.

### Control (RossTalk)

The switcher accepts RossTalk on TCP port 7788, nothing has to be enabled on it. Enter the IP address of the frame (192.168.0.123 from the factory) in the module configuration.

**Available actions**

- Trigger GPI
- Fire custom control
- Cut, Auto Transition, Fade to black
- XPT (select a source on Program, Preset, a key, an Aux bus or a MiniME)
- Transition Keyer, Key Mode
- Next Transition: included elements, Transition Rate, Transition Type
- Recall Memory, Store Memory
- Load Set, Save Set
- Load Media-Store
- Set Source Name
- Clip Player, Clip Player: Load Clip
- Initialize Chroma Key
- List supported commands
- Send a custom command

The commands are those of the [Ross RossTalk reference](https://help.rossvideo.com/carbonite-device/Topics/Protocol/RossTalk/CNT/RT-CNT-Comm.html). Older software versions do not know all of them: run **List supported commands** and read the module log to see what your switcher accepts. The switcher gives no answer to a command, so an action that is refused fails silently.

The HDMI inputs come after the SDI inputs: `IN:13` on the Solo 13, `IN:7` to `IN:9` on the Solo.

### Feedback (TSL UMD v3.1)

RossTalk gives no status. For feedback, the switcher has to send TSL UMD to Companion:

1. On the switcher press **MENU > SYSTEM > NEXT > NEXT > Device Config**.
2. Press **Add** and select an ethernet slot.
3. Set **Type** to `SerialTally`, then **SubType** to `TSLUMD_1.0`.
4. Enter the IP address of the computer running Companion.
5. Set **Port** to the _TSL Listen Port_ of this module (5727 by default) and **Transport** to the _TSL Transport_ of this module (UDP by default).
6. Set **ShowUMDId** to `On` and **ShowBusName** to `Off`.
7. Set **1SecUpdate** to `On` so that Companion catches up quickly after a restart.

Open the listen port in the firewall of the computer running Companion.

**Feedbacks**

- **Tally: source on Program / Preview**: the tally the switcher sends for an input or a Media-Store (TSL tally 2 is program, tally 1 is preview).
- **Bus: source selected**: the source selected on ME 1 Background or Preset, on a key, on an Aux bus or on a MiniME. With **ShowUMDId** off the switcher only sends the name of the source, and the feedback is wrong when two sources have the same name. Black and Matte Color share TSL ID 0 and cannot be told apart.
- **TSL: tally of an address**: any tally of any TSL address.

**Variables**

- `source_in1_name` ..., `source_ms1_name` ...: source names set on the switcher.
- `bus_me1_bkgd_source`, `bus_me1_pst_source`, `bus_aux1_source` ...: name of the source selected on the bus, and `..._source_id` for its TSL ID.

The TSL addresses used are those of the Carbonite Black Solo column of the [Ross TSL UMD setup page](https://help.rossvideo.com/carbonite-device/Topics/Devices/UMD/TSL.html).
